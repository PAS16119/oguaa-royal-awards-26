import { sql } from '@/lib/db';
import { requireAnySession } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';
import { genAccessCode } from '@/lib/codegen';

// GET: main admin sees every code; an agent only sees the codes they generated.
export async function GET() {
  const session = await requireAnySession();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rows = (session.role === 'main-admin' || session.role === 'co-admin')
    ? await sql`SELECT * FROM codes ORDER BY created_at DESC`
    : await sql`SELECT * FROM codes WHERE issued_by_type = 'agent' AND issued_by_id = ${session.id} ORDER BY created_at DESC`;

  return Response.json({ codes: rows });
}

// POST: generate 1-50 codes. Only ever call this AFTER payment has been
// physically confirmed — there is no self-service / online issuance path.
export async function POST(req) {
  const session = await requireAnySession();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { count } = await req.json();
  const n = Math.max(1, Math.min(50, parseInt(count) || 1));

  const issuedByType = session.role;
  const issuedById = (session.role === 'agent' || session.role === 'co-admin') ? session.id : null;
  const issuedByName = session.role === 'agent' ? session.name
    : session.role === 'co-admin' ? `Co-Admin · ${session.name}`
    : 'Main Admin';
  const actor = actorFromSession(session);

  const out = [];
  for (let i = 0; i < n; i++) {
    let code = genAccessCode();
    let exists = await sql`SELECT 1 FROM codes WHERE code = ${code}`;
    while (exists.length > 0) {
      code = genAccessCode();
      exists = await sql`SELECT 1 FROM codes WHERE code = ${code}`;
    }
    await sql`
      INSERT INTO codes (code, status, source, issued_by_type, issued_by_id, issued_by_name, created_at)
      VALUES (${code}, 'unused', 'offline', ${issuedByType}, ${issuedById}, ${issuedByName}, now())
    `;
    await logAudit(actor, 'code_generated', { code });
    out.push(code);
  }

  return Response.json({ codes: out });
}
