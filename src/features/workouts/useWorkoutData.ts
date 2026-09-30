import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { writeTransaction } from '@/db/writeTransaction';

import { getWorkout, listWorkouts } from './repository';

import type { WorkoutDatabase } from './repository';
import type { Workout, WorkoutSummary } from './types';

export function useWorkoutDatabase(): WorkoutDatabase {
  const db = useSQLiteContext();
  return useMemo(() => ({
    getFirstAsync: db.getFirstAsync.bind(db), getAllAsync: db.getAllAsync.bind(db), runAsync: db.runAsync.bind(db),
    transaction: (task: Parameters<WorkoutDatabase['transaction']>[0]) => writeTransaction(db.databasePath, task),
  }), [db]);
}

// Shared focus refresh for the list/Home and detail. Editor loads only once to protect its draft.
export function useWorkoutData(id?: string) {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ items: WorkoutSummary[]; workout: Workout | null; status: 'loading' | 'ready' | 'error'; revision: number }>({ items: [], workout: null, status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: 'loading', revision }));
    void (async () => {
      try {
        const workout = id ? await getWorkout(db, id) : null;
        const items = id ? [] : await listWorkouts(db);
        if (active) setState({ items, workout, status: 'ready', revision });
      } catch { if (active) setState({ items: [], workout: null, status: 'error', revision }); }
    })();
    return () => { active = false; };
  }, [db, id, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
