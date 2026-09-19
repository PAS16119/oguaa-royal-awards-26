import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payments = await sql`
    SELECT reference, buyer_name, email, phone, quantity, amount_pesewas, status, channel, codes, created_at, paid_at
    FROM payments ORDER BY created_at DESC LIMIT 500
  `;
  return Response.json({ payments });
}
