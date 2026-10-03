export const extension = (path: string) => (path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : undefined);
