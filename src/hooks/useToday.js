import { useEffect, useState } from 'react';
import { todayStr } from '../lib/dates.js';

/** Today's "YYYY-MM-DD", re-rendering just after local midnight so trip phases stay current. */
export function useToday() {
  const [today, setToday] = useState(todayStr);
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const t = setTimeout(() => setToday(todayStr()), midnight - now);
    return () => clearTimeout(t);
  }, [today]);
  return today;
}
