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
  if (row.actor_type === 'co-admin') return `Co-Admin · ${row.actor_name} (${row.actor_id})`;
  if (row.actor_type === 'agent') return `Agent · ${row.actor_name} (${row.actor_id})`;
  if (row.actor_type === 'online') return 'Online purchase';
  if (row.actor_type === 'public') return row.actor_name ? `Public · ${row.actor_name}` : 'Public';
  return 'System';
}

// Builds the {type, id, name} actor object a route should log, from a session.
export function actorFromSession(session) {
  if (!session) return { type: 'system' };
  if (session.role === 'agent') return { type: 'agent', id: session.id, name: session.name };
  if (session.role === 'co-admin') return { type: 'co-admin', id: session.id, name: session.name };
  return { type: 'main-admin' };
}
