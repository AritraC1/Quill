import { useCallback, useEffect, useState } from "react";

export function useStoredSet(key: string, initial: string[] = []) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* storage unavailable: keep in-memory only */
    }
  }, [key, items]);

  const has = useCallback((id: string) => items.includes(id), [items]);

  const set = useCallback(
    (id: string, on: boolean) =>
      setItems((prev) =>
        on
          ? prev.includes(id)
            ? prev
            : [...prev, id]
          : prev.filter((x) => x !== id),
      ),
    [],
  );

  return { items, has, set };
}
