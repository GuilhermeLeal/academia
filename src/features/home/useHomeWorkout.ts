import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';

import {
  getHomeWorkoutSelection,
  type HomeWorkoutSelection,
} from './repository';

type HomeWorkoutState = {
  selection: HomeWorkoutSelection | null;
  status: 'loading' | 'ready' | 'error';
  revision: number;
};

export function useHomeWorkout() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<HomeWorkoutState>({
    selection: null,
    status: 'loading',
    revision: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;

      setState((current) => ({ ...current, status: 'loading', revision }));

      getHomeWorkoutSelection(db)
        .then((selection) => {
          if (isCurrent) {
            setState({ selection, status: 'ready', revision });
          }
        })
        .catch(() => {
          if (isCurrent) {
            setState((current) => ({ ...current, status: 'error' }));
          }
        });

      return () => {
        isCurrent = false;
      };
    }, [db, revision]),
  );

  const retry = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  return { ...state, retry };
}
