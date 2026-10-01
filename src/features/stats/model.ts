import type {
  CompletedExerciseOccurrence, CompletedSessionTime, MonthlyStats, OverallStats,
  StatsSummary, WeeklyDayStatus,
} from './types.ts';

const weekDayNames = [
  { label: 'S', name: 'Segunda' },
  { label: 'T', name: 'Terça' },
  { label: 'Q', name: 'Quarta' },
  { label: 'Q', name: 'Quinta' },
  { label: 'S', name: 'Sexta' },
  { label: 'S', name: 'Sábado' },
  { label: 'D', name: 'Domingo' },
] as const;

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function startOfLocalWeek(value: Date): Date {
  const start = startOfLocalDay(value);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  return start;
}

function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function localDateKey(value: Date): string {
  return [
    String(value.getFullYear()).padStart(4, '0'),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateFromLocalKey(key: string): Date {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function validFinishedDate(session: CompletedSessionTime): Date | null {
  const value = new Date(session.finishedAt);
  return Number.isFinite(value.getTime()) ? value : null;
}

export function normalizeLocalMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function shiftLocalMonth(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function getLocalMonthRange(value: Date): { start: string; end: string } {
  const start = normalizeLocalMonth(value);
  return { start: start.toISOString(), end: shiftLocalMonth(start, 1).toISOString() };
}

export function formatMonthTitle(value: Date): string {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${monthNames[value.getMonth()]} ${value.getFullYear()}`;
}

function calculateStreaks(weekKeys: Set<string>, currentWeek: Date): Pick<StatsSummary, 'currentStreak' | 'longestStreak'> {
  let currentStreak = 0;
  let cursor = weekKeys.has(localDateKey(currentWeek)) ? currentWeek : addLocalDays(currentWeek, -7);
  while (weekKeys.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor = addLocalDays(cursor, -7);
  }

  let longestStreak = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of [...weekKeys].sort()) {
    const week = dateFromLocalKey(key);
    run = previous && localDateKey(addLocalDays(previous, 7)) === key ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = week;
  }
  return { currentStreak, longestStreak };
}

export function summarizeStats(sessions: CompletedSessionTime[], now = new Date()): StatsSummary {
  const currentWeek = startOfLocalWeek(now);
  const nextWeek = addLocalDays(currentWeek, 7);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayKey = localDateKey(now);
  const completedDayKeys = new Set<string>();
  const completedWeekKeys = new Set<string>();
  let completedThisWeek = 0;
  let completedThisMonth = 0;
  let totalMonthSeconds = 0;

  for (const session of sessions) {
    const finished = validFinishedDate(session);
    if (!finished) continue;
    completedWeekKeys.add(localDateKey(startOfLocalWeek(finished)));
    if (finished >= currentWeek && finished < nextWeek) {
      completedThisWeek += 1;
      completedDayKeys.add(localDateKey(finished));
    }
    if (finished >= currentMonth && finished < nextMonth) {
      completedThisMonth += 1;
      const startedMs = Date.parse(session.startedAt);
      if (Number.isFinite(startedMs)) {
        totalMonthSeconds += Math.max(0, Math.floor((finished.getTime() - startedMs) / 1000));
      }
    }
  }

  const weekDays: WeeklyDayStatus[] = weekDayNames.map((day, index) => {
    const date = addLocalDays(currentWeek, index);
    const key = localDateKey(date);
    return { ...day, key, completed: completedDayKeys.has(key), isToday: key === todayKey };
  });
  return {
    completedThisWeek,
    completedThisMonth,
    totalMonthSeconds,
    ...calculateStreaks(completedWeekKeys, currentWeek),
    weekDays,
  };
}

export function summarizeMonth(
  sessions: CompletedSessionTime[],
  selectedMonth: Date,
  now = new Date(),
): MonthlyStats {
  const month = normalizeLocalMonth(selectedMonth);
  const nextMonth = shiftLocalMonth(month, 1);
  const trainedDays = new Set<string>();
  let workoutCount = 0;
  let totalSeconds = 0;
  for (const session of sessions) {
    const finished = validFinishedDate(session);
    if (!finished || finished < month || finished >= nextMonth) continue;
    workoutCount += 1;
    trainedDays.add(localDateKey(finished));
    const started = Date.parse(session.startedAt);
    if (Number.isFinite(started)) {
      totalSeconds += Math.max(0, Math.floor((finished.getTime() - started) / 1000));
    }
  }

  const leadingDays = (month.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = localDateKey(now);
  const calendarDays: MonthlyStats['calendarDays'] = Array.from({ length: leadingDays }, () => null);
  for (let day = 1; day <= dayCount; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = localDateKey(date);
    calendarDays.push({ key, day, trained: trainedDays.has(key), isToday: key === todayKey });
  }
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  return {
    year: month.getFullYear(),
    month: month.getMonth(),
    workoutCount,
    totalSeconds,
    trainedDayCount: trainedDays.size,
    calendarDays,
  };
}

export function summarizeOverallStats(
  sessions: CompletedSessionTime[],
  completedSetCount: number,
  occurrences: CompletedExerciseOccurrence[],
): OverallStats {
  const validSessions = sessions.flatMap((session) => {
    const finished = validFinishedDate(session);
    return finished ? [{ session, finished }] : [];
  }).sort((a, b) => a.finished.getTime() - b.finished.getTime());
  const trainedDays = new Set(validSessions.map(({ finished }) => localDateKey(finished)));
  let totalSeconds = 0;
  for (const { session, finished } of validSessions) {
    const started = Date.parse(session.startedAt);
    if (Number.isFinite(started)) {
      totalSeconds += Math.max(0, Math.floor((finished.getTime() - started) / 1000));
    }
  }

  const occurrenceCounts = new Map<string, { name: string; count: number }>();
  for (const occurrence of occurrences) {
    const current = occurrenceCounts.get(occurrence.exerciseKey);
    occurrenceCounts.set(occurrence.exerciseKey, {
      name: current?.name ?? occurrence.exerciseName,
      count: (current?.count ?? 0) + 1,
    });
  }
  const mostPerformedExercise = [...occurrenceCounts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'),
  )[0] ?? null;
  const first = validSessions[0];
  const latest = validSessions.at(-1);
  const inclusiveWeeks = first && latest ? countInclusiveLocalWeeks(first.finished, latest.finished) : 0;

  return {
    totalWorkouts: validSessions.length,
    totalSeconds,
    trainedDayCount: trainedDays.size,
    completedSetCount,
    averageWorkoutsPerWeek: inclusiveWeeks > 0 ? validSessions.length / inclusiveWeeks : 0,
    longestStreak: summarizeStats(sessions).longestStreak,
    mostPerformedExercise,
    firstWorkoutAt: first?.session.finishedAt ?? null,
    latestWorkoutAt: latest?.session.finishedAt ?? null,
  };
}

function countInclusiveLocalWeeks(first: Date, latest: Date): number {
  const lastWeek = startOfLocalWeek(latest);
  let cursor = startOfLocalWeek(first);
  let count = 0;
  while (cursor <= lastWeek) {
    count += 1;
    cursor = addLocalDays(cursor, 7);
  }
  return count;
}

export function formatStatsDuration(totalSeconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}
