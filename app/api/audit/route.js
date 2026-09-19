import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';

export async function GET() {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await sql`SELECT * FROM audit_log ORDER BY ts DESC LIMIT 500`;
  return Response.json({ audit: rows });
}
