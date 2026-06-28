import { useEffect, useMemo } from 'react';

const STORAGE_KEY = 'mockly:lastScript';

const readLast = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeLast = (next) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable, fail silently */
  }
};

/**
 * Picks one script per demo type from the provided pool, avoiding the
 * id stored in localStorage as the last shown for that demo.
 *
 * The pick is computed once via useMemo (stable across re-renders of the
 * same mount). The localStorage write happens in useEffect so render stays
 * pure (no side effects during render).
 *
 * @param {{ dashboard: object[], behavioural: object[], technical: object[] }} pools
 * @returns {{ dashboard: object, behavioural: object, technical: object }}
 */
export function useScriptPicker(pools) {
  const { picked, nextLast } = useMemo(() => {
    const last = readLast();
    const next = { ...last };
    const result = {};

    for (const demo of ['dashboard', 'behavioural', 'technical']) {
      const pool = pools[demo] || [];
      if (pool.length === 0) {
        result[demo] = null;
        continue;
      }
      const candidates = pool.length > 1
        ? pool.filter((s) => s.id !== last[demo])
        : pool;
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      result[demo] = choice;
      next[demo] = choice.id;
    }

    return { picked: result, nextLast: next };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeLast(nextLast);
  }, [nextLast]);

  return picked;
}
