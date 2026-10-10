const name = new Intl.DateTimeFormat('en', { month: 'long' });

/** The month a time falls in, as the thread list heads them: `October`, with its year once it is another year's, `December 2025`. */
export function monthOf(at: number, now = new Date()) {
  const date = new Date(at);

  return date.getFullYear() === now.getFullYear() ? name.format(date) : `${name.format(date)} ${date.getFullYear()}`;
}
