import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './auth';

// Read + verify the current caller's session from the httpOnly cookie.
// Returns null if there's no session or it's invalid/expired.
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function requireMainAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'main-admin') return null;
  return session;
}

export async function requireAnySession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

// Main Admin or Co-Admin — day-to-day committee work (awards, nominations,
// codes, exports, audit trail) but not Settings, Agents, or Co-Admin management.
export async function requireAdminLevel() {
  const session = await getSession();
  if (!session || (session.role !== 'main-admin' && session.role !== 'co-admin')) return null;
  return session;
}

// The sections a Co-Admin's access can be narrowed to. Kept in one place so
// the create/edit UI, the login token, and every route's check agree on the
// same list. Order here is also the display order in the co-admin editor.
export const ADMIN_SECTIONS = [
  ['awards', 'Awards & Categories'],
  ['codes', 'Access Codes'],
  ['payments', 'Online Sales'],
  ['voting', 'Voting'],
  ['nominations', 'Nominations'],
  ['export', 'Export'],
  ['audit', 'Audit Trail'],
];

// Main Admin always has every section. A Co-Admin with permissions === null
// (the default — nothing ever narrowed) also has every section, so nobody
// is locked out just because this feature exists. Once a Main Admin sets an
// explicit permissions object, only the sections marked true are allowed.
export function sectionAllowed(session, section) {
  if (!session) return false;
  if (session.role === 'main-admin') return true;
  if (session.role === 'co-admin') {
    if (!session.permissions) return true;
    return session.permissions[section] === true;
  }
  return false;
}

// Same idea as requireAdminLevel(), but scoped to one admin section — use
// this in any route that belongs to a specific tab (Awards, Codes, Online
// Sales, Voting, Nominations, Audit) so a Co-Admin whose access has been
// narrowed gets a real 403 from the API, not just a hidden button.
export async function requireSection(section) {
  const session = await getSession();
  if (!session || (session.role !== 'main-admin' && session.role !== 'co-admin')) return null;
  if (!sectionAllowed(session, section)) return null;
  return session;
}
