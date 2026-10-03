import type { Scenario } from '../types.js';
import { agentCommand } from './agent-command.js';
import { backgroundTests, devServer } from './background.js';
import { greeting } from './greeting.js';
import { rateLimiting } from './rate-limiting.js';

/** In the order their patterns are tried. Rate limiting has none, so it is the fallback any other prompt plays, and comes last. */
export const scenarios: Scenario[] = [agentCommand, greeting, devServer, backgroundTests, rateLimiting];
