import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { normalizeExerciseText } from './normalize';
import { searchExercises } from './repository';

import type { Exercise } from './types';

type SearchState = { query: string; revision: number; items: Exercise[]; status: 'loading' | 'ready' | 'error' };

export function useExerciseSearch(query: string) {
  const db = useSQLiteContext();
  const normalized = normalizeExerciseText(query);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SearchState>({ query: '', revision: 0, items: [], status: 'loading' });

  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ query: normalized, revision, items: [], status: 'loading' });
    // Brief debounce for typing; no delay when browsing the whole catalog.
    const timer = setTimeout(() => {
      void searchExercises(db, normalized).then(
        (items) => { if (active) setState({ query: normalized, revision, items, status: 'ready' }); },
        () => { if (active) setState({ query: normalized, revision, items: [], status: 'error' }); },
      );
    }, normalized ? 100 : 0);
    // Ignore outdated responses and queries completing after blur/unmount.
    return () => { active = false; clearTimeout(timer); };
  }, [db, normalized, revision]));

  return {
    items: state.query === normalized && state.revision === revision ? state.items : [],
    status: state.query === normalized && state.revision === revision ? state.status : 'loading',
    retry: () => setRevision((value) => value + 1),
  };
}
