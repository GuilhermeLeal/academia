import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';

import { getLocalMonthRange, summarizeMonth, summarizeOverallStats, summarizeStats } from './model';
import {
  countCompletedSets, getExerciseEvolution, listCompletedExerciseOccurrences,
  listCompletedSessionTimes, listCompletedSessionTimesInRange, listEvolutionExercises,
} from './repository';

import type {
  EvolutionExercise, ExerciseEvolution, MonthlyStats, OverallStats, StatsSummary,
} from './types';

type LoadStatus = 'loading' | 'ready' | 'error';

export function useStatsOverview() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    summary: StatsSummary | null;
    exercises: EvolutionExercise[];
    status: LoadStatus;
    revision: number;
  }>({ summary: null, exercises: [], status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: value.summary ? 'ready' : 'loading', revision }));
    void Promise.all([listCompletedSessionTimes(db), listEvolutionExercises(db)]).then(
      ([sessions, exercises]) => {
        if (active) setState({ summary: summarizeStats(sessions), exercises, status: 'ready', revision });
      },
      () => { if (active) setState({ summary: null, exercises: [], status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

export function useStatsSummary() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    summary: StatsSummary | null;
    status: LoadStatus;
    revision: number;
  }>({ summary: null, status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: value.summary ? 'ready' : 'loading', revision }));
    void listCompletedSessionTimes(db).then(
      (sessions) => { if (active) setState({ summary: summarizeStats(sessions), status: 'ready', revision }); },
      () => { if (active) setState({ summary: null, status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

export function useMonthlyStats(selectedMonth: Date) {
  const db = useWorkoutDatabase();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const monthKey = `${year}-${month}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    summary: MonthlyStats | null;
    status: LoadStatus;
    monthKey: string;
    revision: number;
  }>({ summary: null, status: 'loading', monthKey, revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ summary: null, status: 'loading', monthKey, revision });
    const localMonth = new Date(year, month, 1);
    const range = getLocalMonthRange(localMonth);
    void listCompletedSessionTimesInRange(db, range.start, range.end).then(
      (sessions) => {
        if (active) setState({
          summary: summarizeMonth(sessions, localMonth), status: 'ready', monthKey, revision,
        });
      },
      () => { if (active) setState({ summary: null, status: 'error', monthKey, revision }); },
    );
    return () => { active = false; };
  }, [db, month, monthKey, revision, year]));
  const isCurrentMonth = state.monthKey === monthKey;
  return {
    ...state,
    summary: isCurrentMonth ? state.summary : null,
    status: isCurrentMonth ? state.status : 'loading',
    retry: () => setRevision((value) => value + 1),
  };
}

export function useOverallStats() {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    summary: OverallStats | null;
    status: LoadStatus;
    revision: number;
  }>({ summary: null, status: 'loading', revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState((value) => ({ ...value, status: value.summary ? 'ready' : 'loading', revision }));
    void Promise.all([
      listCompletedSessionTimes(db),
      countCompletedSets(db),
      listCompletedExerciseOccurrences(db),
    ]).then(
      ([sessions, completedSetCount, occurrences]) => {
        if (active) setState({
          summary: summarizeOverallStats(sessions, completedSetCount, occurrences),
          status: 'ready',
          revision,
        });
      },
      () => { if (active) setState({ summary: null, status: 'error', revision }); },
    );
    return () => { active = false; };
  }, [db, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

export function useExerciseEvolution(exerciseId: string | null) {
  const db = useWorkoutDatabase();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    evolution: ExerciseEvolution | null;
    status: LoadStatus;
    exerciseId: string | null;
    revision: number;
  }>({ evolution: null, status: exerciseId ? 'loading' : 'ready', exerciseId: null, revision: 0 });
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!exerciseId) {
      setState({ evolution: null, status: 'ready', exerciseId: null, revision });
      return () => { active = false; };
    }
    setState((value) => ({
      evolution: value.exerciseId === exerciseId ? value.evolution : null,
      status: value.exerciseId === exerciseId && value.evolution ? 'ready' : 'loading',
      exerciseId,
      revision,
    }));
    void getExerciseEvolution(db, exerciseId).then(
      (evolution) => { if (active) setState({ evolution, status: 'ready', exerciseId, revision }); },
      () => { if (active) setState({ evolution: null, status: 'error', exerciseId, revision }); },
    );
    return () => { active = false; };
  }, [db, exerciseId, revision]));
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
