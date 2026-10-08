import type { UserId } from '@/types/identity';

export type UserScoped<T> = T & { userId: UserId };
