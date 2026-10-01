import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { initializeDatabase } from '../src/db/migrations.ts';
import { createCustomExercise } from '../src/features/exercises/repository.ts';
import {
  getLocalMonthRange, shiftLocalMonth, startOfLocalWeek, summarizeMonth,
  summarizeOverallStats, summarizeStats,
} from '../src/features/stats/model.ts';
import {
  countCompletedSets, getExerciseEvolution, listCompletedExerciseOccurrences,
  listCompletedSessionTimes, listCompletedSessionTimesInRange, listEvolutionExercises,
} from '../src/features/stats/repository.ts';

import type { CompletedSessionTime } from '../src/features/stats/types.ts';

function localIso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function completed(
  id: string,
  year: number,
  month: number,
  day: number,
  durationMinutes = 30,
): CompletedSessionTime {
  const finished = new Date(year, month - 1, day, 12);
  const started = new Date(finished.getTime() - durationMinutes * 60_000);
  return { id, startedAt: started.toISOString(), finishedAt: finished.toISOString() };
}

test('local weeks run from Monday through Sunday', () => {
  const now = new Date(2026, 9, 4, 23, 59);
  const monday = startOfLocalWeek(now);
  assert.deepEqual(
    [monday.getFullYear(), monday.getMonth() + 1, monday.getDate(), monday.getDay()],
    [2026, 9, 28, 1],
  );
  const summary = summarizeStats([
    completed('monday', 2026, 9, 28),
    completed('sunday', 2026, 10, 4),
    completed('previous-sunday', 2026, 9, 27),
  ], now);
  assert.equal(summary.completedThisWeek, 2);
  assert.deepEqual(summary.weekDays.map((day) => day.completed), [true, false, false, false, false, false, true]);
});

test('an empty current week preserves the streak from consecutive previous weeks', () => {
  const summary = summarizeStats([
    completed('previous', 2026, 9, 21),
    completed('two-weeks-ago', 2026, 9, 14),
  ], new Date(2026, 8, 30, 12));
  assert.equal(summary.completedThisWeek, 0);
  assert.equal(summary.currentStreak, 2);
  assert.equal(summary.longestStreak, 2);
});

test('an entirely empty past week breaks the current streak', () => {
  const summary = summarizeStats([
    completed('two-weeks-ago', 2026, 9, 14),
    completed('three-weeks-ago', 2026, 9, 7),
  ], new Date(2026, 8, 30, 12));
  assert.equal(summary.currentStreak, 0);
  assert.equal(summary.longestStreak, 2);
});

test('current and longest streaks plus weekly and monthly totals use completed timestamps', () => {
  const sessions = [
    completed('historic-1', 2026, 8, 3, 20),
    completed('historic-2', 2026, 8, 10, 25),
    completed('historic-3', 2026, 8, 17, 30),
    completed('month-start', 2026, 9, 1, 40),
    completed('previous-week', 2026, 9, 21, 50),
    completed('current-1', 2026, 9, 28, 60),
    completed('current-2', 2026, 9, 30, 70),
  ];
  const summary = summarizeStats(sessions, new Date(2026, 8, 30, 20));
  assert.equal(summary.currentStreak, 2);
  assert.equal(summary.longestStreak, 3);
  assert.equal(summary.completedThisWeek, 2);
  assert.equal(summary.completedThisMonth, 4);
  assert.equal(summary.totalMonthSeconds, (40 + 50 + 60 + 70) * 60);
});

test('monthly calendar uses local days, collapses repeated workout days and totals durations', () => {
  const selectedMonth = new Date(2026, 7, 1);
  const sessions: CompletedSessionTime[] = [
    {
      id: 'midnight-local',
      startedAt: localIso(2026, 8, 1, 0, 0),
      finishedAt: localIso(2026, 8, 1, 0, 30),
    },
    {
      id: 'same-day',
      startedAt: localIso(2026, 8, 1, 18, 0),
      finishedAt: localIso(2026, 8, 1, 19, 0),
    },
    completed('other-day', 2026, 8, 15, 42),
  ];
  const summary = summarizeMonth(sessions, selectedMonth, new Date(2026, 7, 15, 8));
  assert.equal(summary.workoutCount, 3);
  assert.equal(summary.trainedDayCount, 2);
  assert.equal(summary.totalSeconds, (30 + 60 + 42) * 60);
  const trained = summary.calendarDays.filter((day) => day?.trained);
  assert.deepEqual(trained.map((day) => day?.day), [1, 15]);
  assert.equal(trained.find((day) => day?.day === 15)?.isToday, true);
  assert.equal(summary.calendarDays.filter((day) => day?.day === 1).length, 1);
});

test('changing months changes the summary, supports empty months and crosses years', () => {
  const sessions = [
    completed('july', 2026, 7, 5, 20),
    completed('august-1', 2026, 8, 2, 30),
    completed('august-2', 2026, 8, 3, 40),
  ];
  const july = summarizeMonth(sessions, new Date(2026, 6, 1));
  const august = summarizeMonth(sessions, new Date(2026, 7, 1));
  const june = summarizeMonth(sessions, new Date(2026, 5, 1));
  assert.deepEqual(
    [july.workoutCount, july.totalSeconds, july.trainedDayCount],
    [1, 20 * 60, 1],
  );
  assert.deepEqual(
    [august.workoutCount, august.totalSeconds, august.trainedDayCount],
    [2, 70 * 60, 2],
  );
  assert.deepEqual([june.workoutCount, june.totalSeconds, june.trainedDayCount], [0, 0, 0]);
  const january = shiftLocalMonth(new Date(2026, 11, 1), 1);
  const december = shiftLocalMonth(new Date(2027, 0, 1), -1);
  assert.deepEqual([january.getFullYear(), january.getMonth()], [2027, 0]);
  assert.deepEqual([december.getFullYear(), december.getMonth()], [2026, 11]);
});

test('overall summary calculates real totals, extremes, weekly average and most performed exercise', () => {
  const sessions = [
    completed('first', 2026, 8, 3, 30),
    completed('second', 2026, 8, 10, 60),
    completed('latest', 2026, 8, 31, 90),
  ];
  const summary = summarizeOverallStats(sessions, 7, [
    { exerciseKey: 'squat', exerciseName: 'Agachamento' },
    { exerciseKey: 'bench', exerciseName: 'Supino Reto' },
    { exerciseKey: 'squat', exerciseName: 'Agachamento' },
  ]);
  assert.equal(summary.totalWorkouts, 3);
  assert.equal(summary.totalSeconds, 180 * 60);
  assert.equal(summary.trainedDayCount, 3);
  assert.equal(summary.completedSetCount, 7);
  assert.equal(summary.averageWorkoutsPerWeek, 3 / 5);
  assert.equal(summary.longestStreak, 2);
  assert.deepEqual(summary.mostPerformedExercise, { name: 'Agachamento', count: 2 });
  assert.equal(summary.firstWorkoutAt, sessions[0]?.finishedAt);
  assert.equal(summary.latestWorkoutAt, sessions[2]?.finishedAt);
});

test('exercise evolution groups a custom exercise by exerciseId and ignores active sessions and incomplete sets', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await initializeDatabase(db);
    const exercise = await createCustomExercise(db, {
      name: 'Supino personalizado', muscleGroup: 'Peitoral', equipment: 'Barra',
    });
    await insertSession(db, 'older', 'completed', localIso(2026, 9, 10, 9), localIso(2026, 9, 10, 10));
    await insertSession(db, 'newer', 'completed', localIso(2026, 9, 20, 9), localIso(2026, 9, 20, 10));
    await insertSession(db, 'same-day', 'completed', localIso(2026, 9, 20, 10), localIso(2026, 9, 20, 11));
    await insertSession(db, 'active', 'active', localIso(2026, 9, 30, 9), null);
    await insertExerciseResult(db, 'older-exercise', 'older', exercise.id, exercise.name, [
      { weight: 30, reps: 10, completed: 1 },
      { weight: 80, reps: 2, completed: 0 },
    ]);
    await insertExerciseResult(db, 'newer-exercise', 'newer', exercise.id, exercise.name, [
      { weight: 40, reps: 8, completed: 1 },
      { weight: 37.5, reps: 10, completed: 1 },
    ]);
    await insertExerciseResult(db, 'active-exercise', 'active', exercise.id, exercise.name, [
      { weight: 99, reps: 1, completed: 1 },
    ]);

    const sessions = await listCompletedSessionTimes(db);
    assert.deepEqual(sessions.map((session) => session.id), ['older', 'newer', 'same-day']);
    const range = getLocalMonthRange(new Date(2026, 8, 1));
    const monthlySessions = await listCompletedSessionTimesInRange(db, range.start, range.end);
    assert.deepEqual(monthlySessions.map((session) => session.id), ['older', 'newer', 'same-day']);
    const monthly = summarizeMonth(monthlySessions, new Date(2026, 8, 1));
    assert.equal(monthly.workoutCount, 3);
    assert.equal(monthly.trainedDayCount, 2);
    const exercises = await listEvolutionExercises(db);
    assert.deepEqual(exercises, [{ exerciseId: exercise.id, exerciseName: 'Supino personalizado' }]);
    const evolution = await getExerciseEvolution(db, exercise.id); assert(evolution);
    assert.equal(evolution.latestWeight, 37.5);
    assert.equal(evolution.latestReps, 10);
    assert.equal(evolution.maxWeight, 40);
    assert.deepEqual(
      evolution.entries.map(({ sessionId, setNumber, weight, reps }) => ({ sessionId, setNumber, weight, reps })),
      [
        { sessionId: 'newer', setNumber: 2, weight: 37.5, reps: 10 },
        { sessionId: 'newer', setNumber: 1, weight: 40, reps: 8 },
        { sessionId: 'older', setNumber: 1, weight: 30, reps: 10 },
      ],
    );
    assert.equal(await countCompletedSets(db), 3);
    const exerciseOccurrences = await listCompletedExerciseOccurrences(db);

    assert.deepEqual(exerciseOccurrences.map((occurrence) => ({ ...occurrence })), [
      { exerciseKey: exercise.id, exerciseName: 'Supino personalizado' },
      { exerciseKey: exercise.id, exerciseName: 'Supino personalizado' },
    ]);
  } finally {
    database.close();
  }
});

async function insertSession(
  db: ReturnType<typeof adapt>,
  id: string,
  status: 'active' | 'completed',
  startedAt: string,
  finishedAt: string | null,
) {
  await db.runAsync(
    `INSERT INTO workout_sessions (id, workout_name, started_at, finished_at, status)
     VALUES (?, 'Treino de teste', ?, ?, ?)`,
    id, startedAt, finishedAt, status,
  );
}

async function insertExerciseResult(
  db: ReturnType<typeof adapt>,
  id: string,
  sessionId: string,
  exerciseId: string,
  exerciseName: string,
  sets: { weight: number; reps: number; completed: 0 | 1 }[],
) {
  await db.runAsync(
    `INSERT INTO session_exercises
     (id, session_id, exercise_id, exercise_name, position, planned_sets,
      planned_reps_min, planned_reps_max, planned_rest_seconds)
     VALUES (?, ?, ?, ?, 0, ?, 8, 12, 60)`,
    id, sessionId, exerciseId, exerciseName, sets.length,
  );
  for (const [index, set] of sets.entries()) {
    await db.runAsync(
      `INSERT INTO session_sets
       (id, session_exercise_id, set_number, weight, reps, completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      `${id}-set-${index + 1}`, id, index + 1, set.weight, set.reps, set.completed,
    );
  }
}
