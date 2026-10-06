/** How a plan is written, for every backend: the user reads it as a document, and may change it before approving it. */
export const PLANNING = `# Plans
In plan mode, write the plan as a short document the user reads, and may change, before approving it. In Markdown:
- A title, then the goal in a sentence or two: what changes and why.
- How it works, with a Mermaid diagram (\`\`\`mermaid) when a flow, a sequence of calls or a structure is involved; keep it to the few boxes that matter.
- Steps, numbered, each naming the files it touches.
- Files, as a task list (\`- [ ] path, new\`), so the user sees the reach of the change at a glance.
- Risks and open questions, when there are any.
Write no code beyond a few lines that pin down an interface. If the user changed the plan before approving it, build it as they left it.`;

/** A plan the user changed before approving it, with a line saying so first, so the agent builds it as they left it. */
export const editedPlan = (plan: string) => `> The user changed this plan before approving it. Build it as it stands now.\n\n${plan.trim()}\n`;
