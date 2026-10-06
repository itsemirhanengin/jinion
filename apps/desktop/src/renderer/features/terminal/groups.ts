/** The terminals in split groups, each group's panes side by side, in the order the list shows them. */
export type Groups = string[][];

/**
 * The groups held against the terminals there are: a terminal gone leaves its group, an empty group goes, and a
 * terminal not in any, such as one the agent just started, gets a group of its own at the end.
 */
export function reconcile(groups: Groups, terminals: string[]): Groups {
  const open = new Set(terminals);
  const kept = groups.map((group) => group.filter((id) => open.has(id))).filter((group) => group.length > 0);
  const placed = new Set(kept.flat());

  return [...kept, ...terminals.filter((id) => !placed.has(id)).map((id) => [id])];
}

/**
 * `added` beside `beside`, in its group, as a split does; out of the group of its own it may have got already, as the
 * list of terminals can come before the answer that opened it.
 */
export function splitBeside(groups: Groups, beside: string, added: string): Groups {
  return groups
    .map((group) => group.filter((id) => id !== added))
    .filter((group) => group.length > 0)
    .map((group) => {
      const at = group.indexOf(beside);

      return at === -1 ? group : [...group.slice(0, at + 1), added, ...group.slice(at + 1)];
    });
}

/** The group the terminal is in. */
export const groupOf = (groups: Groups, id: string | undefined) => groups.find((group) => id !== undefined && group.includes(id));
