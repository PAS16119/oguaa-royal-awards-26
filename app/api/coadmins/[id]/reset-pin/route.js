import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { hashPin } from '@/lib/auth';
import { randDigits } from '@/lib/codegen';

export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id).toUpperCase();
  const rows = await sql`SELECT * FROM coadmins WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Co-Admin not found.' }, { status: 404 });

  const pin = randDigits(6);
  const pinHash = await hashPin(pin);
  await sql`UPDATE coadmins SET pin_hash = ${pinHash} WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, 'coadmin_pin_reset', { coAdminId: id, coAdminName: rows[0].name });

  return Response.json({ pin });
}
