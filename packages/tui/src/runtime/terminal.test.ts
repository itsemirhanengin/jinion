import { describe, expect, it } from 'vitest';
import { notificationMethod, notificationSequence } from './terminal.js';

describe('notificationMethod', () => {
  it('picks the sequence each terminal shows', () => {
    expect(notificationMethod({ TERM_PROGRAM: 'ghostty' })).toBe('osc777');
    expect(notificationMethod({ TERM_PROGRAM: 'WezTerm' })).toBe('osc777');
    expect(notificationMethod({ TERM_PROGRAM: 'iTerm.app' })).toBe('osc9');
    expect(notificationMethod({ TERM: 'xterm-kitty', KITTY_WINDOW_ID: '1' })).toBe('osc99');
  });

  it('rings the bell elsewhere and inside tmux, which would keep the sequence to itself', () => {
    expect(notificationMethod({ TERM_PROGRAM: 'Apple_Terminal' })).toBe('bell');
    expect(notificationMethod({ TERM_PROGRAM: 'vscode' })).toBe('bell');
    expect(notificationMethod({ TERM_PROGRAM: 'ghostty', TMUX: '/tmp/tmux-501/default,1,0' })).toBe('bell');
  });
});

describe('notificationSequence', () => {
  it('keeps control characters out, so the text can’t end the sequence', () => {
    expect(notificationSequence('osc777', 'jinion; api', 'Done\x07 now\n')).toBe('\x1b]777;notify;jinion, api;Done  now \x07');
    expect(notificationSequence('osc9', 'jinion', 'Done')).toBe('\x1b]9;jinion: Done\x07');
    expect(notificationSequence('osc99', 'jinion', 'Done')).toBe('\x1b]99;i=1:d=0;jinion\x1b\\\x1b]99;i=1:p=body;Done\x1b\\');
    expect(notificationSequence('bell', 'jinion', 'Done')).toBe('\x07');
  });
});
