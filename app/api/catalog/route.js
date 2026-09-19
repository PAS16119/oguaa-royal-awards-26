import { getCatalog } from '@/lib/catalog';
import { requireMainAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/catalog?track=paid|free            -> public, active items only
// GET /api/catalog?track=free&all=1           -> main admin only, includes inactive
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track');
  const wantAll = searchParams.get('all') === '1';

  if (wantAll) {
    const session = await requireMainAdmin();
    if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sections = await getCatalog({
    track: track === 'paid' || track === 'free' ? track : null,
    includeInactive: wantAll,
  });

  return Response.json({ sections });
}
