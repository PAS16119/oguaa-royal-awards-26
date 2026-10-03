import { sql } from './db';
import { newVoteReference } from './votes';
import { chargeMobileMoney, submitOtp, mapNetworkToProvider } from './momo';
import { logAudit } from './audit';

// --- session storage -------------------------------------------------------
// Arkesel only sends the single latest keypress per request (see schema-v5.sql
// comment), so we persist where each sessionID is up to between requests.

async function loadSession(sessionId) {
  const rows = await sql`SELECT * FROM ussd_sessions WHERE session_id = ${sessionId}`;
  if (rows.length === 0) return null;
  const row = rows[0];
  // Neon's driver normally parses jsonb into an object already; this guards
  // against the rare case where it comes back as a raw string instead.
  if (typeof row.data === 'string') { try { row.data = JSON.parse(row.data); } catch { row.data = {}; } }
  return row;
}

async function saveSession(sessionId, msisdn, network, state, data) {
  await sql`
    INSERT INTO ussd_sessions (session_id, msisdn, network, state, data, updated_at)
    VALUES (${sessionId}, ${msisdn}, ${network}, ${state}, ${JSON.stringify(data)}, now())
    ON CONFLICT (session_id) DO UPDATE SET
      state = EXCLUDED.state, data = EXCLUDED.data, updated_at = now()
  `;
}

async function endSession(sessionId) {
  await sql`DELETE FROM ussd_sessions WHERE session_id = ${sessionId}`;
}

// --- small helpers -----------------------------------------------------

// USSD text must stay plain ASCII. A single non-GSM character (an em dash, a
// curly quote, an accented letter in a nominee's name) makes the network send
// the whole screen as UCS-2, which caps it at roughly 70 characters instead
// of 160 — that is what cut the "1. Confirm / 2. Cancel" lines off the last
// confirm screen. Everything goes through here so it can't happen again.
function ascii(text) {
  return String(text ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '');
}

// Shorten `text` to `max` characters, ending in ".." when it had to be cut.
function clip(text, max) {
  const t = ascii(text);
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 2)).trimEnd() + '..';
}

function con(message) { return { message: ascii(message), continueSession: true }; }
function end(message) { return { message: ascii(message), continueSession: false }; }

async function getConfig() {
  const rows = await sql`SELECT * FROM config WHERE id = 'main'`;
  return rows[0] || {};
}

function votingWindowOpen(cfg) {
  if (!cfg.voting_enabled) return false;
  const now = new Date();
  if (cfg.voting_open_date && now < new Date(String(cfg.voting_open_date).slice(0, 10))) return false;
  if (cfg.voting_close_date && now > new Date(String(cfg.voting_close_date).slice(0, 10) + 'T23:59:59')) return false;
  return true;
}

// --- the state machine ------------------------------------------------
// One function per state. Each takes (input, session, cfg) and returns
// either con(message) / end(message), or { next: 'stateName', data } to
// move to another state and re-render it immediately (used once, for the
// welcome -> menu transition, so the caller never sees an empty screen).

async function stateWelcome(input, session, cfg) {
  const price = Number(cfg.vote_price_ghs) || 1;
  return con(`Oguaa Royal Awards\n1. Vote (GHS ${price} per vote)\n2. Check votes\n0. Back`);
}

async function stateMainMenu(input, session, cfg) {
  if (input === '1') {
    if (!votingWindowOpen(cfg)) return end('Voting is not open right now. Try again later or visit ora26.vercel.app/vote');
    // Anyone who's had 2+ payments not go through in the last 45 minutes is
    // steered toward the web link before they re-type a code and vote count
    // — that flow's success rate has been far higher for these callers than
    // repeating USSD, per the failed/abandoned pattern seen in Paystack.
    const troubleRows = await sql`
      SELECT count(*) AS n FROM vote_payments
      WHERE phone = ${session.msisdn} AND status != 'paid' AND created_at > now() - interval '45 minutes'
    `;
    const struggling = parseInt(troubleRows[0]?.n) >= 2;
    const msg = struggling
      ? 'Having trouble paying by USSD? Try ora26.vercel.app/vote instead.\nEnter the candidate code, or 0 to cancel:'
      : 'Enter the candidate code, or 0 to cancel:';
    return { next: 'await_code', message: con(msg) };
  }
  if (input === '2') {
    return { next: 'results_code', message: con('Enter the candidate code to check votes:') };
  }
  if (input === '0') return end('Thank you for supporting the Oguaa Royal Awards!');
  const price = Number(cfg.vote_price_ghs) || 1;
  return con(`Invalid choice.\n1. Vote (GHS ${price} per vote)\n2. Check votes\n0. Back`);
}

// Name and award are clipped so the options line always fits on screen.
function candidateScreen(name, award) {
  return `${clip(name, 26)}\n${clip(award, 34)}\n1. Confirm\n0. Back (wrong code)`;
}

async function stateAwaitCode(input, session, cfg) {
  const code = input.trim();
  if (code === '0') return end('Cancelled.');
  const rows = await sql`SELECT * FROM candidates WHERE ballot_code = ${code} AND active = true`;
  if (rows.length === 0) {
    return con('Code not found. Enter the candidate code, or 0 to cancel:');
  }
  const candidate = rows[0];
  return {
    next: 'confirm_candidate',
    data: { candidateId: candidate.id, candidateName: candidate.nominee_name, award: candidate.award_name },
    message: con(candidateScreen(candidate.nominee_name, candidate.award_name)),
  };
}

async function stateConfirmCandidate(input, session, cfg) {
  if (input === '0' || input === '2') {
    return { next: 'await_code', message: con('Enter the candidate code, or 0 to cancel:') };
  }
  if (input !== '1') {
    return con(candidateScreen(session.data.candidateName, session.data.award));
  }
  const maxVotes = parseInt(cfg.max_votes_per_purchase) || 500;
  return {
    next: 'await_votes',
    message: con(`Enter number of votes (1-${maxVotes}):`),
  };
}

async function stateAwaitVotes(input, session, cfg) {
  const maxVotes = parseInt(cfg.max_votes_per_purchase) || 500;
  const votes = parseInt(input.trim());
  if (!Number.isInteger(votes) || votes < 1 || votes > maxVotes) {
    return con(`Enter a number between 1 and ${maxVotes}:`);
  }
  const pricePerVote = Number(cfg.vote_price_ghs) || 1;
  const amountGHS = (pricePerVote * votes).toFixed(2);
  return {
    next: 'confirm',
    data: { ...session.data, votes, amountGHS },
    message: con(`${votes} vote(s) for ${clip(session.data.candidateName, 26)}\nTotal: GHS ${amountGHS}\n1. Pay now\n0. Cancel`),
  };
}

async function stateConfirm(input, session, cfg) {
  if (input === '0' || input === '2') return end('Cancelled. No payment was made.');
  if (input !== '1') return con(`Reply with:\n1. Pay now\n0. Cancel`);

  // Re-check everything server-side right before money moves — the session
  // could be minutes old by now.
  if (!votingWindowOpen(cfg)) return end('Voting closed while you were deciding. Nothing was charged.');

  // Rate limit: cap how many charge attempts one phone number can trigger in
  // a short window. The USSD webhook secret is the main gate against abuse,
  // but a leaked secret (or a malfunctioning caller retrying fast) shouldn't
  // be able to spam Paystack charge attempts against one number unbounded.
  const recentAttempts = await sql`
    SELECT count(*) AS n FROM vote_payments
    WHERE phone = ${session.msisdn} AND created_at > now() - interval '10 minutes'
  `;
  if (parseInt(recentAttempts[0]?.n) >= 8) {
    return end('Too many payment attempts from this number in a short time. Please wait a few minutes and try again.');
  }

  const candRows = await sql`SELECT * FROM candidates WHERE id = ${session.data.candidateId} AND active = true`;
  if (candRows.length === 0) return end('That candidate is no longer on the ballot. Nothing was charged.');

  const provider = mapNetworkToProvider(session.network);
  if (!provider) {
    return end(`Couldn't detect your mobile money network. Please vote online instead at ora26.vercel.app/vote`);
  }

  const pricePerVote = Number(cfg.vote_price_ghs) || 1;
  const votes = session.data.votes;
  const amountPesewas = Math.round(pricePerVote * votes * 100);
  const reference = newVoteReference();

  await sql`
    INSERT INTO vote_payments (reference, candidate_id, package_id, votes, buyer_name, email, phone, amount_pesewas, currency, status)
    VALUES (${reference}, ${session.data.candidateId}, NULL, ${votes}, 'USSD voter', NULL, ${session.msisdn}, ${amountPesewas}, 'GHS', 'pending')
  `;

  const chargeArgs = {
    phone: session.msisdn,
    provider,
    amountPesewas,
    reference,
    metadata: { purpose: 'votes', channel: 'ussd', candidate_id: session.data.candidateId, votes },
  };
  const auditActor = { type: 'online', id: reference, name: 'USSD - ' + session.msisdn };

  // The charge answer decides what this session shows next (an OTP prompt,
  // an "approve on your phone" notice, or an honest failure), so it happens
  // inside the session for every network.
  let charge;
  try {
    charge = await chargeMobileMoney(chargeArgs);
  } catch (e) {
    console.error('USSD charge failed:', reference, e.message || e);
    await sql`UPDATE vote_payments SET status = 'failed' WHERE reference = ${reference}`;
    return end('Could not start the payment. Please try again shortly.');
  }

  // Record exactly what Paystack answered (status + its own wording) so
  // Admin > Audit Trail shows why a vote did or didn't get a prompt.
  await logAudit(auditActor, 'ussd_vote_charge_initiated', {
    reference, candidateId: session.data.candidateId, votes, amountGHS: session.data.amountGHS,
    status: charge.status, displayText: charge.display_text || null, message: charge.message || null,
  });

  if (charge.status === 'send_otp') {
    return {
      next: 'await_otp',
      data: { ...session.data, reference },
      message: con(charge.display_text || 'Enter the code sent to you by SMS to confirm payment:'),
    };
  }
  if (charge.status === 'success') {
    return end(`Payment received! ${votes} vote(s) for ${clip(session.data.candidateName, 26)} will show shortly.`);
  }
  if (charge.status === 'pay_offline' || charge.status === 'pending') {
    return end(`Approve GHS ${session.data.amountGHS} on your phone to complete your ${votes} vote(s).`);
  }

  // Anything else (failed, abandoned, an unknown status) means no prompt is
  // coming. Say so instead of telling the voter to approve something that
  // doesn't exist.
  console.error('USSD charge not accepted:', reference, charge.status, charge.display_text || charge.message);
  await sql`UPDATE vote_payments SET status = 'failed' WHERE reference = ${reference}`;
  return end('Payment could not be started. Nothing was charged. Try again, or vote at ora26.vercel.app/vote');
}

async function stateResultsCode(input, session, cfg) {
  const code = input.trim();
  const rows = await sql`SELECT * FROM candidates WHERE ballot_code = ${code} AND active = true`;
  if (rows.length === 0) return end('Candidate code not found.');
  const c = rows[0];
  if (!cfg.results_public) {
    // Results closed: position only, never the score.
    const ahead = await sql`
      SELECT COUNT(*)::int AS n FROM candidates
      WHERE active = true AND award_name = ${c.award_name} AND section_label = ${c.section_label}
        AND votes > ${c.votes}
    `;
    if (Number(c.votes) === 0) return end(`${c.nominee_name} (${c.award_name}): no ranking yet.`);
    return end(`${c.nominee_name} (${c.award_name}): currently #${ahead[0].n + 1}. Vote counts are private for now.`);
  }
  return end(`${c.nominee_name} (${c.award_name}): ${c.votes} vote(s) so far.`);
}

// --- entry point ---------------------------------------------------------

export async function handleUssd({ sessionId, userID, msisdn, userData, network, newSession }) {
  const cfgPromise = getConfig();
  // Read the session in parallel with the config: one round trip saved on
  // every keypress, which is most of the "slow" feel on a Neon connection.
  const sessionPromise = newSession ? Promise.resolve(null) : loadSession(sessionId);
  const cfg = await cfgPromise;

  if (newSession) {
    await saveSession(sessionId, msisdn, network, 'main_menu', {});
    return await stateWelcome(userData, null, cfg);
  }

  const session = await sessionPromise;
  if (!session) {
    // Session vanished (expired, or Arkesel retried after we already ended
    // it) — restart cleanly rather than erroring the caller mid-dial.
    await saveSession(sessionId, msisdn, network, 'main_menu', {});
    return await stateWelcome(userData, null, cfg);
  }

  const input = String(userData ?? '').trim();
  let result;

  switch (session.state) {
    case 'main_menu':        result = await stateMainMenu(input, session, cfg); break;
    case 'await_code':       result = await stateAwaitCode(input, session, cfg); break;
    case 'confirm_candidate': result = await stateConfirmCandidate(input, session, cfg); break;
    case 'await_votes':      result = await stateAwaitVotes(input, session, cfg); break;
    case 'confirm':          result = await stateConfirm(input, session, cfg); break;
    case 'await_otp': {
      const otp = input;
      let otpResult;
      try {
        otpResult = await submitOtp({ reference: session.data.reference, otp });
      } catch (e) {
        result = end('That code did not work. Please dial again to retry.');
        break;
      }
      if (otpResult.status === 'success') {
        result = end(`Payment confirmed! Your ${session.data.votes} vote(s) will appear shortly.`);
      } else if (otpResult.status === 'pay_offline' || otpResult.status === 'pending') {
        // Some MTN numbers need the SMS code first, then the usual approval.
        result = end(`Code accepted. Now approve GHS ${session.data.amountGHS} on your phone to complete your ${session.data.votes} vote(s).`);
      } else {
        result = end('Payment could not be confirmed with that code. Please dial again to retry.');
      }
      break;
    }
    case 'results_code': result = await stateResultsCode(input, session, cfg); break;
    default:
      result = await stateWelcome(input, session, cfg);
  }

  // stateMainMenu returns { next, message } wrappers for transitions that
  // also need to persist new data (candidateId, votes, etc.); other states
  // just return a con()/end() message directly.
  if (result.next) {
    await saveSession(sessionId, msisdn, network, result.next, result.data || session.data);
    return result.message;
  }

  if (!result.continueSession) {
    await endSession(sessionId);
  } else {
    // Same state, just re-prompting (e.g. invalid input) — touch updated_at.
    await saveSession(sessionId, msisdn, network, session.state, session.data);
  }
  return result;
}
