import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { hashPin } from '@/lib/auth';
import { genAgentId, randDigits } from '@/lib/codegen';

// GET: list all agents with stats (codes generated/used/revenue), main admin only.
export async function GET() {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`
    SELECT
      a.id, a.name, a.active, a.created_at, a.last_login_at,
      COUNT(c.code) FILTER (WHERE c.issued_by_type = 'agent') AS total_codes,
      COUNT(c.code) FILTER (WHERE c.issued_by_type = 'agent' AND c.status = 'used') AS used_codes
    FROM agents a
    LEFT JOIN codes c ON c.issued_by_id = a.id AND c.issued_by_type = 'agent'
    GROUP BY a.id
    ORDER BY a.name
  `;
  return Response.json({ agents: rows });
}

// POST: create a new agent. Returns the plaintext PIN once — it is never
// retrievable again after this response.
export async function POST(req) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await req.json();
  if (!name || !name.trim()) return Response.json({ error: 'Agent name is required.' }, { status: 400 });

  let id = genAgentId();
  let exists = await sql`SELECT 1 FROM agents WHERE id = ${id}`;
  while (exists.length > 0) {
    id = genAgentId();
    exists = await sql`SELECT 1 FROM agents WHERE id = ${id}`;
  }

  const pin = randDigits(6);
  const pinHash = await hashPin(pin);
  await sql`
    INSERT INTO agents (id, name, pin_hash, active, created_at, created_by)
    VALUES (${id}, ${name.trim()}, ${pinHash}, true, now(), 'main-admin')
  `;
  await logAudit({ type: 'main-admin' }, 'agent_created', { agentId: id, agentName: name.trim() });

  return Response.json({ id, name: name.trim(), pin });
}
