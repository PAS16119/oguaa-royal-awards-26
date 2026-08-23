import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configRows = await sql`SELECT * FROM config WHERE id = 'main'`;
  const countRows = await sql`SELECT COUNT(*)::int AS count FROM nominations`;
  return Response.json({
    config: configRows[0] || null,
    nominationCount: countRows[0]?.count || 0,
  });
}
