import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { db, schema as s } from '@/db/client';

export function usePrefs() {
  const { data } = useLiveQuery(db.select().from(s.preferences).where(eq(s.preferences.singletonId, 1)));
  return data[0] ?? null;
}

/** Reloj que avanza cada minuto, para estados derivados como «vencido». */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
