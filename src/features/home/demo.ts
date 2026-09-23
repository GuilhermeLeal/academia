// UI fixtures only. These values never become workout/history records.
export const demoWorkout = {
  name: 'Superiores A',
  focus: 'Peito, costas e braços',
  estimatedMinutes: 45,
  exerciseCount: 6,
} as const;

export const demoWeek = {
  completed: 2,
  goal: 4,
  streak: 2,
  days: [
    { label: 'S', name: 'Segunda', state: 'done' },
    { label: 'T', name: 'Terça', state: 'rest' },
    { label: 'Q', name: 'Quarta', state: 'done' },
    { label: 'Q', name: 'Quinta', state: 'today' },
    { label: 'S', name: 'Sexta', state: 'rest' },
    { label: 'S', name: 'Sábado', state: 'rest' },
    { label: 'D', name: 'Domingo', state: 'rest' },
  ],
} as const;
