import type { Palette } from './pieces.js';

export interface Accent {
  name: string;
  palette: Palette;
}

interface Tones {
  chrome: string;
  raised: string;
  ink: string;
  inkChannels: string;
  muted: string;
  faint: string;
  primary: string;
}

/** The colors a user picks from: each tints the chrome under the white cards and gives the one strong color. */
export const accents: Accent[] = [
  accent('Navy', {
    chrome: '#eceef3',
    raised: '#f4f5f8',
    ink: '#12162a',
    inkChannels: '18 22 42',
    muted: '#5c6275',
    faint: '#989dae',
    primary: '#181e33',
  }),
  accent('Ocean', {
    chrome: '#e7eef4',
    raised: '#f1f5f9',
    ink: '#0f1a24',
    inkChannels: '15 26 36',
    muted: '#566876',
    faint: '#91a1ae',
    primary: '#1f5a85',
  }),
  accent('Plum', {
    chrome: '#f0ebf1',
    raised: '#f7f4f8',
    ink: '#1c1421',
    inkChannels: '28 20 33',
    muted: '#6a5e70',
    faint: '#a497a9',
    primary: '#5a3266',
  }),
  accent('Clay', {
    chrome: '#f3ece6',
    raised: '#f9f5f1',
    ink: '#201813',
    inkChannels: '32 24 19',
    muted: '#6f6158',
    faint: '#a8998e',
    primary: '#9a4a2a',
  }),
  accent('Graphite', {
    chrome: '#ececec',
    raised: '#f5f5f5',
    ink: '#151515',
    inkChannels: '21 21 21',
    muted: '#656565',
    faint: '#a0a0a0',
    primary: '#202020',
  }),
];

function accent(name: string, tones: Tones): Accent {
  return {
    name,
    palette: {
      '--chrome': tones.chrome,
      '--background': '#ffffff',
      '--raised': tones.raised,
      '--floating': '#ffffff',
      '--ink': tones.ink,
      '--muted': tones.muted,
      '--faint': tones.faint,
      '--line': `rgb(${tones.inkChannels} / 0.07)`,
      '--edge': `rgb(${tones.inkChannels} / 0.1)`,
      '--shade': `rgb(${tones.inkChannels} / 0.045)`,
      '--selected': `rgb(${tones.inkChannels} / 0.07)`,
      '--primary': tones.primary,
      '--on-primary': '#ffffff',
      '--field': '14px',
    },
  };
}
