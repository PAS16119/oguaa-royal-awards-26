'use client';
import { useEffect, useState } from 'react';

// Ticks every `ms` so countdowns stay live without re-fetching anything.
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// "3 days 4h", "5h 12m", "42m" — or null once the time has passed.
export function fmtRemaining(msLeft) {
  if (!(msLeft > 0)) return null;
  const mins = Math.floor(msLeft / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d >= 1) return `${d} day${d === 1 ? '' : 's'} ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}
