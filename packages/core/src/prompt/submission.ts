import type { AgentPrompt } from '../agent/agent.js';

/**
 * What the user sent: `text` as they typed it, which the conversation shows, and `prompt` when what goes to the agent
 * differs, with pasted text expanded and images. The client keeps what was pasted, so it sends both.
 */
export interface Submission {
  text: string;
  prompt?: AgentPrompt;
}

export const promptOf = ({ text, prompt }: Submission): AgentPrompt => prompt ?? { text };
