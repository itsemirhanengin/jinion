import type { Signal, Turn } from '@/lib/data/types';

// Ordinary events a turn can have that say nothing bad about it.
const NEUTRAL: Signal[] = ['compacted', 'permission-denied'];

export const isProblem = (signal: Signal) => !NEUTRAL.includes(signal);

export const hasProblem = (turn: Turn) => turn.signals.some(isProblem);
