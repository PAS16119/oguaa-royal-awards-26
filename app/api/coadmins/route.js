import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { hashPin } from '@/lib/auth';
import { genCoAdminId, randDigits } from '@/lib/codegen';

// GET: list all co-admins. Main admin only.
export async function GET() {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`SELECT id, name, active, created_at, last_login_at, permissions FROM coadmins ORDER BY name`;
  return Response.json({ coadmins: rows });
}

// POST: create a new co-admin. Returns the plaintext PIN once — it is never
// retrievable again after this response. Only the Main Admin can do this,
// so access to the committee-helper role always traces back to one person.
// `permissions` is optional: omit it (or send null) for full access, same as
// every co-admin created before this feature existed; send an object like
// { awards: true, codes: false, ... } to start them narrowed from day one.
export async function POST(req) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { name, permissions } = await req.json();
  if (!name || !name.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });

  let id = genCoAdminId();
  let exists = await sql`SELECT 1 FROM coadmins WHERE id = ${id}`;
  while (exists.length > 0) {
    id = genCoAdminId();
    exists = await sql`SELECT 1 FROM coadmins WHERE id = ${id}`;
  }

  const pin = randDigits(6);
  const pinHash = await hashPin(pin);
  const perms = permissions && typeof permissions === 'object' ? JSON.stringify(permissions) : null;
  await sql`
    INSERT INTO coadmins (id, name, pin_hash, active, created_at, created_by, permissions)
    VALUES (${id}, ${name.trim()}, ${pinHash}, true, now(), 'main-admin', ${perms}::jsonb)
  `;
  await logAudit({ type: 'main-admin' }, 'coadmin_created', { coAdminId: id, coAdminName: name.trim() });

  return Response.json({ id, name: name.trim(), pin });
}
