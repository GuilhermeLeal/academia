import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';

import { getHistorySession, listCompletedSessions } from './repository';

import type { HistorySessionDetail, HistorySessionListItem } from './types';

type LoadStatus = 'loading' | 'ready' | 'error';

export function useHistorySessions() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ items: HistorySessionListItem[]; status: LoadStatus; revision: number }>({
    items: [], status: 'loading', revision: 0,
  });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: 'loading', revision }));
    void listCompletedSessions(db).then(
      (items) => { if (active) setState({ items, status: 'ready', revision }); },
      () => { if (active) setState({ items: [], status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

export function useHistorySession(id: string) {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ session: HistorySessionDetail | null; status: LoadStatus; revision: number }>({
    session: null, status: 'loading', revision: 0,
  });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: 'loading', revision }));
    void getHistorySession(db, id).then(
      (session) => { if (active) setState({ session, status: 'ready', revision }); },
      () => { if (active) setState({ session: null, status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, id, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
