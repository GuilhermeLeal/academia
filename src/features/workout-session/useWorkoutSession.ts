import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';

import { getActiveSession, getSession } from './repository';

import type { ActiveSessionSummary, WorkoutSession } from './types';

export function useActiveWorkoutSession() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ session: ActiveSessionSummary | null; status: 'loading' | 'ready' | 'error'; revision: number }>({ session: null, status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: 'loading', revision }));
    void getActiveSession(db).then(
      (session) => { if (active) setState({ session, status: 'ready', revision }); },
      () => { if (active) setState({ session: null, status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

export function useWorkoutSession(id: string) {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ session: WorkoutSession | null; status: 'loading' | 'ready' | 'error'; revision: number }>({ session: null, status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: 'loading', revision }));
    void getSession(db, id).then(
      (session) => { if (active) setState({ session, status: 'ready', revision }); },
      () => { if (active) setState({ session: null, status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, id, revision]));
  return { ...state, reload: () => setRevision((value) => value + 1) };
}
