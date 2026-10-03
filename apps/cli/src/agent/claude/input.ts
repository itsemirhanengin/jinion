export type Input = Record<string, unknown>;

export const isObject = (value: unknown): value is Input => typeof value === 'object' && value !== null && !Array.isArray(value);

export const text = (value: unknown) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value));

export const number = (value: unknown) => (typeof value === 'number' ? value : undefined);
