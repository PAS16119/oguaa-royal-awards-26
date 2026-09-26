import { sql } from '@/lib/db';
import { put } from '@vercel/blob';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024; // matches app/api/upload/route.js

// GET — look up a candidate by their ballot code. Public, same trust model as
// /vote/poster/[code]: knowing the code (only given to that nominee/the
// committee) is what stands in for a login here.
export async function GET(req, { params }) {
  const code = decodeURIComponent(params.code || '').trim();
  if (!code) return Response.json({ error: 'Missing code.' }, { status: 400 });

  const rows = await sql`SELECT id, nominee_name, award_name, photo_url, ballot_code FROM candidates WHERE ballot_code = ${code}`;
  if (rows.length === 0) return Response.json({ error: 'No candidate found with that code.' }, { status: 404 });
  return Response.json({ candidate: rows[0] });
}

// PATCH — a nominee updates their own photo. { dataUrl }. Deliberately narrow:
// this route can ONLY change photo_url for the one candidate that code
// belongs to — nothing else on the ballot (name, votes, active) is reachable
// from here, unlike the admin-only PATCH at /api/candidates/[id].
export async function PATCH(req, { params }) {
  const code = decodeURIComponent(params.code || '').trim();
  if (!code) return Response.json({ error: 'Missing code.' }, { status: 400 });

  const rows = await sql`SELECT * FROM candidates WHERE ballot_code = ${code}`;
  if (rows.length === 0) return Response.json({ error: 'No candidate found with that code.' }, { status: 404 });
  const candidate = rows[0];

  const { dataUrl } = await req.json();
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return Response.json({ error: 'No valid image data provided.' }, { status: 400 });
  }
  const base64 = dataUrl.split(',')[1];
  if (!base64) return Response.json({ error: 'Malformed image data.' }, { status: 400 });
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_BYTES) return Response.json({ error: 'Image too large.' }, { status: 400 });

  const filename = `nominees/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const blob = await put(filename, buffer, { access: 'public', contentType: 'image/jpeg' });

  await sql`UPDATE candidates SET photo_url = ${blob.url} WHERE id = ${candidate.id}`;
  await logAudit({ type: 'public', name: candidate.nominee_name }, 'candidate_photo_self_updated', {
    candidateId: candidate.id, ballotCode: code,
  });

  return Response.json({ ok: true, url: blob.url });
}
