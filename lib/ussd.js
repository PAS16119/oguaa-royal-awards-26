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

function con(message) { return { message, continueSession: true }; }
function end(message) { return { message, continueSession: false }; }

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

async function stateWelcome(input) {
  return con('Oguaa Royal Awards\n1. Vote for a candidate\n2. Check votes\n0. Exit');
}

async function stateMainMenu(input, session, cfg) {
  if (input === '1') {
    if (!votingWindowOpen(cfg)) return end('Voting is not open right now. Try again later or visit ora26.vercel.app/vote');
    return { next: 'await_code', message: con('Enter the candidate code (e.g. 204):') };
  }
  if (input === '2') {
    return { next: 'results_code', message: con('Enter the candidate code to check votes:') };
  }
  if (input === '0') return end('Thank you for supporting the Oguaa Royal Awards!');
  return con('Invalid choice.\n1. Vote for a candidate\n2. Check votes\n0. Exit');
}

async function stateAwaitCode(input, session, cfg) {
  const code = input.trim();
  if (code === '0') return end('Cancelled.');
  const rows = await sql`SELECT * FROM candidates WHERE ballot_code = ${code} AND active = true`;
  if (rows.length === 0) {
    return con('Code not found. Enter the candidate code, or 0 to cancel:');
  }
  const candidate = rows[0];
  const maxVotes = parseInt(cfg.max_votes_per_purchase) || 500;
  return {
    next: 'await_votes',
    data: { candidateId: candidate.id, candidateName: candidate.nominee_name, award: candidate.award_name },
    message: con(`${candidate.nominee_name} — ${candidate.award_name}\nEnter number of votes (1-${maxVotes}):`),
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
    message: con(`Confirm: ${votes} vote(s) for ${session.data.candidateName} = GHS ${amountGHS}\n1. Confirm & Pay\n2. Cancel`),
  };
}

async function stateConfirm(input, session, cfg) {
  if (input === '2') return end('Cancelled. No payment was made.');
  if (input !== '1') return con(`1. Confirm & Pay\n2. Cancel`);

  // Re-check everything server-side right before money moves — the session
  // could be minutes old by now.
  if (!votingWindowOpen(cfg)) return end('Voting closed while you were deciding. Nothing was charged.');
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

  let charge;
  try {
    charge = await chargeMobileMoney({
      phone: session.msisdn,
      provider,
      amountPesewas,
      reference,
      metadata: { purpose: 'votes', channel: 'ussd', candidate_id: session.data.candidateId, votes },
    });
  } catch (e) {
    await sql`UPDATE vote_payments SET status = 'failed' WHERE reference = ${reference}`;
    return end('Could not start the payment. Please try again shortly.');
  }

  await logAudit(
    { type: 'online', id: reference, name: 'USSD · ' + session.msisdn },
    'ussd_vote_charge_initiated',
    { reference, candidateId: session.data.candidateId, votes, amountGHS: session.data.amountGHS, status: charge.status },
  );

  if (charge.status === 'send_otp') {
    return {
      next: 'await_otp',
      data: { ...session.data, reference },
      message: con(charge.display_text || 'Enter the code sent to confirm payment:'),
    };
  }
  if (charge.status === 'success') {
    return end(`Payment received! ${votes} vote(s) for ${session.data.candidateName} will show shortly.`);
  }
  // pay_offline (MTN) and anything else Paystack accepts async — the
  // webhook credits the votes once charge.success arrives; nothing more
  // for this USSD session to do.
  return end(`Approve the GHS ${session.data.amountGHS} request on your phone to complete your ${votes} vote(s).`);
}

async function stateResultsCode(input, session, cfg) {
  const code = input.trim();
  const rows = await sql`SELECT * FROM candidates WHERE ballot_code = ${code} AND active = true`;
  if (rows.length === 0) return end('Candidate code not found.');
  if (!cfg.results_public) {
    return end('Results are not public right now. Check back later, or visit ora26.vercel.app/vote/results once they are.');
  }
  const c = rows[0];
  return end(`${c.nominee_name} (${c.award_name}): ${c.votes} vote(s) so far.`);
}

// --- entry point ---------------------------------------------------------

export async function handleUssd({ sessionId, userID, msisdn, userData, network, newSession }) {
  const cfg = await getConfig();

  if (newSession) {
    await saveSession(sessionId, msisdn, network, 'main_menu', {});
    return await stateWelcome(userData);
  }

  const session = await loadSession(sessionId);
  if (!session) {
    // Session vanished (expired, or Arkesel retried after we already ended
    // it) — restart cleanly rather than erroring the caller mid-dial.
    await saveSession(sessionId, msisdn, network, 'main_menu', {});
    return await stateWelcome(userData);
  }

  const input = String(userData ?? '').trim();
  let result;

  switch (session.state) {
    case 'main_menu':   result = await stateMainMenu(input, session, cfg); break;
    case 'await_code':  result = await stateAwaitCode(input, session, cfg); break;
    case 'await_votes': result = await stateAwaitVotes(input, session, cfg); break;
    case 'confirm':     result = await stateConfirm(input, session, cfg); break;
    case 'await_otp': {
      const otp = input;
      let otpResult;
      try {
        otpResult = await submitOtp({ reference: session.data.reference, otp });
      } catch (e) {
        result = end('That code did not work. Please dial again to retry.');
        break;
      }
      result = otpResult.status === 'success'
        ? end(`Payment confirmed! Your ${session.data.votes} vote(s) will appear shortly.`)
        : end('Payment could not be confirmed with that code. Please dial again to retry.');
      break;
    }
    case 'results_code': result = await stateResultsCode(input, session, cfg); break;
    default:
      result = await stateWelcome(input);
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
