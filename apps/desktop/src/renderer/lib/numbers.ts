const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** A large count in a few characters: `279.1M`, `12K`, `840`. */
export function compact(count: number) {
  return compactFormat.format(count);
}

/** `1 day`, `15 days`, `3,790 messages`. */
export function counted(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString('en')} ${count === 1 ? one : many}`;
}
