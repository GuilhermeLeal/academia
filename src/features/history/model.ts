function parseTimestamp(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatHistoryDate(value: string): string {
  const date = parseTimestamp(value);
  return date
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    : 'Data indisponível';
}

export function formatHistoryTime(value: string): string {
  const date = parseTimestamp(value);
  return date
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
    : '—';
}

export function formatHistoryDuration(startedAt: string, finishedAt: string): string {
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  const totalMinutes = Number.isFinite(started) && Number.isFinite(finished)
    ? Math.max(0, Math.floor((finished - started) / 60_000))
    : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}

export function formatSetResult(weight: number | null, reps: number | null): string {
  const weightLabel = weight === null ? null : String(weight).replace('.', ',');
  if (weightLabel !== null && reps !== null) return `${weightLabel} kg × ${reps}`;
  if (reps !== null) return `${reps} reps`;
  if (weightLabel !== null) return `${weightLabel} kg`;
  return 'Resultado não informado';
}
