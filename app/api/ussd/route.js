import { handleUssd } from '@/lib/ussd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Arkesel POSTs JSON shaped like:
// { sessionID, userID, newSession, msisdn, userData, network }
// and expects back:
// { sessionID, userID, msisdn, message, continueSession }
// Confirm these exact field names against your own Arkesel dashboard/docs
// before going live — this was pulled from Arkesel's public USSD examples,
// not tested against a live Arkesel account from here.
export async function POST(req) {
  // Arkesel's USSD callback isn't signed the way the Paystack webhook is
  // (no HMAC header to verify), so as a minimum check, require a shared
  // secret in the URL itself. Set this in the Arkesel dashboard as
  // https://ora26.vercel.app/api/ussd?key=YOUR_SECRET and set the same
  // value as USSD_WEBHOOK_SECRET in Vercel. If you leave the env var unset,
  // the check is skipped — fine for testing in the simulator, not for going live.
  const secret = process.env.USSD_WEBHOOK_SECRET;
  if (secret) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('key') !== secret) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  let body;
  try { body = await req.json(); } catch { return new Response('Bad payload', { status: 400 }); }

  const { sessionID, userID, msisdn, userData, network, newSession } = body;
  if (!sessionID || !msisdn) {
    return Response.json({ sessionID, userID, msisdn, message: 'Bad request.', continueSession: false }, { status: 200 });
  }

  let result;
  try {
    result = await handleUssd({ sessionId: sessionID, userID, msisdn, userData, network, newSession: Boolean(newSession) });
  } catch (e) {
    console.error('USSD handler error:', e);
    // Always answer 200 with a valid shape — a timeout or 5xx leaves the
    // caller's screen frozen until the gateway itself gives up.
    result = { message: 'Something went wrong. Please try again shortly.', continueSession: false };
  }

  return Response.json({
    sessionID,
    userID,
    msisdn,
    message: result.message,
    continueSession: result.continueSession,
  });
}
