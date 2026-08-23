import { sql } from './db';

// Append-only audit trail. Never update or delete rows from audit_log —
// that's what makes it trustworthy.
export async function logAudit(actor, action, details) {
  await sql`
    INSERT INTO audit_log (ts, actor_type, actor_id, actor_name, action, details)
    VALUES (now(), ${actor.type || null}, ${actor.id || null}, ${actor.name || null}, ${action}, ${JSON.stringify(details || {})})
  `;
}

export function actorLabel(row) {
  if (row.actor_type === 'main-admin') return 'Main Admin';
  if (row.actor_type === 'agent') return `Agent · ${row.actor_name} (${row.actor_id})`;
  return 'System';
}
