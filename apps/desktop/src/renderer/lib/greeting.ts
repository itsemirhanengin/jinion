const byTime = {
  morning: ['Good morning, {name}.', 'Morning, {name}. What are we building?', 'Fresh start, {name}. Where do we begin?'],
  afternoon: ['Good afternoon, {name}.', "What's up next, {name}?", 'Back at it, {name}?'],
  evening: ['Good evening, {name}.', 'One more thing before the day ends, {name}?', 'Evening, {name}. What needs doing?'],
  night: ['Burning the midnight oil, {name}?', 'Still up, {name}? What are we fixing?', 'A late one tonight, {name}.'],
};

const byDay = {
  monday: 'New week, {name}. What comes first?',
  friday: "It's Friday, {name}. Let's ship something.",
  weekend: 'A weekend project, {name}?',
};

/** A line for the top of a new thread: one of the time of day's, or the day's own, picked by the date so it holds all day. */
export function greeting(now: Date, name: string) {
  const hour = now.getHours();
  const day = now.getDay();
  const slot = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night';
  const lines = [...byTime[slot]];

  if (day === 1 && slot === 'morning') lines.push(byDay.monday);
  if (day === 5 && slot !== 'night') lines.push(byDay.friday);
  if (day === 0 || day === 6) lines.push(byDay.weekend);

  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);

  return lines[dayOfYear % lines.length]!.replace('{name}', name);
}
