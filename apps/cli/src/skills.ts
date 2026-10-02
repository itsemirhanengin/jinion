import { fuzzyMatch, namedMention, type CompletionItem, type CompletionSource } from '@jinion/tui';
import type { AgentCommand } from './agent/types.js';

const AT_CURSOR = /(?:^|\s)\$([\w.:-]*)$/;

/** The project's skills, the user's, then plugins' and MCP servers' prompts. */
const order = (skill: AgentCommand) =>
  skill.source === 'mcp' ? 3 : skill.group === 'project' ? 0 : skill.group === 'user' ? 1 : 2;

/** The header a skill shows under, e.g. `Yours` or `vercel`. */
export function skillGroup(skill: AgentCommand) {
  if (skill.source === 'mcp') return `${skill.group} prompts`;
  return skill.group === 'project' ? 'Project' : skill.group === 'user' ? 'Yours' : skill.group;
}

/** In the order the pickers show them, grouped. */
export function sortSkills(skills: AgentCommand[]) {
  return [...skills].sort(
    (a, b) => order(a) - order(b) || skillGroup(a).localeCompare(skillGroup(b)) || a.name.localeCompare(b.name),
  );
}

/** `$design` in prompts and messages, for the skills and MCP prompts the agent has. */
export const skillMention = (skills: AgentCommand[]) => namedMention('$', skills.map((skill) => skill.name));

/**
 * Completes `$skill` mentions anywhere in the prompt, grouped by where the skills come from. While typing, the group
 * with the best match comes first, so Enter takes it.
 */
export function skillCompletion(skills: AgentCommand[]): CompletionSource {
  return (value, cursor) => {
    const typed = AT_CURSOR.exec(value.slice(0, cursor));
    if (!typed) return undefined;
    const query = typed[1]!;
    // A name typed out in full is done, so Enter sends the message instead of inserting it again.
    if (skills.some((skill) => skill.name === query)) return undefined;
    const matches = sortSkills(skills).flatMap((skill) => {
      if (!query) return [{ skill, score: 0, positions: [] as number[] }];
      const match = fuzzyMatch(skill.name, query);
      return match ? [{ skill, ...match }] : [];
    });
    const best = new Map<string, number>();
    for (const { skill, score } of matches) best.set(skillGroup(skill), Math.max(score, best.get(skillGroup(skill)) ?? score));
    if (query) {
      matches.sort((a, b) => {
        const [groupA, groupB] = [skillGroup(a.skill), skillGroup(b.skill)];
        return best.get(groupB)! - best.get(groupA)! || order(a.skill) - order(b.skill) || groupA.localeCompare(groupB) || b.score - a.score;
      });
    }
    const items: CompletionItem[] = matches.map(({ skill, positions }) => ({
      key: skill.name,
      label: skill.name,
      positions,
      hint: skill.argumentHint,
      description: skill.description,
      group: skillGroup(skill),
      insert: `$${skill.name} `,
    }));
    return items.length > 0 ? { from: cursor - query.length - 1, to: cursor, items, submit: false } : undefined;
  };
}
