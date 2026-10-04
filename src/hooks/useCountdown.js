import { useEffect, useState } from 'react';

/** [days, hours, minutes, seconds] until targetMs, ticking every second. null once reached. */
export function useCountdown(targetMs) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = targetMs - now;
  if (ms <= 0) return null;
  const sec = Math.floor(ms / 1000);
  return [Math.floor(sec / 86400), Math.floor((sec % 86400) / 3600), Math.floor((sec % 3600) / 60), sec % 60];
}
