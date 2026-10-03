export const channelsOf = (color: string) => [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));

export const hexColor = (channels: number[]) =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
