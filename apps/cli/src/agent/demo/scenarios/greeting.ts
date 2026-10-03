import type { Scenario } from '../types.js';

export const greeting: Scenario = {
  title: 'Say hello',
  match: /^\s*(hi|hello|hey|selam|merhaba|sa)\b/i,
  async *play(script) {
    yield* script.think('Just a greeting. No tools needed, so I will introduce myself and point at what this demo can show.');
    yield* script.usage(1_400, 0.004);
    yield* script.say(
      [
        "Hey! I'm **Jinion**, a coding agent that lives in your terminal.",
        'This build runs a scripted demo agent, so nothing touches your files yet. Ask me to `add rate limiting to the api` to watch the whole loop: reading code, asking you a question, editing files, running tests and recovering from a failing one. `start the dev server` or `run the tests in the background` shows background tasks.',
        '- `/` lists commands, skills and MCP prompts\n- the mouse wheel or `pgup`/`pgdn` scrolls the conversation\n- a click opens folded output, and `ctrl+o` all of it\n- `esc` interrupts a running turn',
      ].join('\n\n'),
    );
  },
};
