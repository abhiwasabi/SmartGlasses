import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface StoredState<T> {
  value: T;
  error: string | null;
}

function readStorage<T>(
  key: string,
  initialValue: T,
  validate: (value: unknown) => value is T,
): StoredState<T> {
  if (typeof window === 'undefined') return { value: initialValue, error: null };

  let saved: string | null;
  try {
    saved = window.localStorage.getItem(key);
  } catch {
    return {
      value: initialValue,
      error: 'Browser storage is unavailable. Changes will only be kept in this tab.',
    };
  }

  if (saved === null) return { value: initialValue, error: null };

  try {
    const parsed: unknown = JSON.parse(saved);
    if (validate(parsed)) return { value: parsed, error: null };
  } catch {
    // Invalid JSON and an unexpected data shape both restore safe default values.
  }

  return {
    value: initialValue,
    error: 'Saved data could not be loaded. Default values are shown until you make a new change.',
  };
}

/** Keep the storage key stable for the lifetime of the component. */
export function useLocalState<T>(
  key: string,
  initialValue: T,
  validate: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, string | null] {
  const [loaded] = useState(() => readStorage(key, initialValue, validate));
  const [value, setValue] = useState<T>(loaded.value);
  const [error, setError] = useState<string | null>(loaded.error);
  const lastSaved = useRef({ key, value: loaded.value });

  useEffect(() => {
    // Do not overwrite unreadable saved data merely by opening the dashboard.
    if (lastSaved.current.key === key && Object.is(lastSaved.current.value, value)) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      lastSaved.current = { key, value };
      setError(null);
    } catch {
      setError('Your latest changes could not be saved. They are available in this tab, but may be lost when you close it.');
    }
  }, [key, value]);

  return [value, setValue, error];
}
