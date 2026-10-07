import type { PickedElement, PreviewPick } from '../../../main/bridge.js';
import type { Submission } from '../../core/core.js';
import type { DraftPick } from '../../state/previews.js';

type ElementPick = Extract<PreviewPick, { kind: 'element' }>;

type AreaPick = Extract<PreviewPick, { kind: 'area' }>;

/**
 * The name a pick goes into the draft with: the component it is in and the element, or the area's number. Without a
 * component the tag keeps its brackets, so a word the user types isn't taken for the chip.
 */
export function pickName(pick: PreviewPick, picks: DraftPick[]) {
  if (pick.kind === 'area') return `Area ${picks.filter((each) => each.pick.kind === 'area').length + 1}`;

  return pick.components[0] ? `${pick.components[0]} ${pick.tag}` : `<${pick.tag}>`;
}

/** The names of the draft's picks, which the composer draws as chips; longest first, so `Area 12` isn't taken for `Area 1`. */
export function pickPattern(picks: DraftPick[]) {
  if (picks.length === 0) return undefined;

  const names = picks.map((each) => each.name).sort((a, b) => b.length - a.length);

  return new RegExp(names.map(escapeRegExp).join('|'));
}

/**
 * The message with the picks still named in it: the conversation shows the names as typed, and the agent gets each as
 * `[Element #1]` or `[Area #1]`, with what it is on the page and a screenshot after the draft's own images.
 */
export function withPicks(submission: Submission, picks: DraftPick[]): Submission {
  const pattern = pickPattern(picks);
  if (!pattern) return submission;

  const typed = submission.prompt?.text ?? submission.text;
  const used: DraftPick[] = [];

  for (const [name] of typed.matchAll(new RegExp(pattern.source, 'g'))) {
    const pick = picks.find((each) => each.name === name)!;

    if (!used.includes(pick)) used.push(pick);
  }

  if (used.length === 0) return submission;

  const labels = labelsOf(used);
  const images = [...(submission.prompt?.images ?? [])];

  const details = used.map((each) => {
    const { image } = each.pick;

    if (image) images.push(image);

    return describe(each.pick, labels.get(each)!, image ? `[Image #${images.length}]` : undefined);
  });

  const text = typed.replace(new RegExp(pattern.source, 'g'), (name) => labels.get(used.find((each) => each.name === name)!)!);
  const note = ['I pointed at these on the page in the preview. Each is named where I mention it, with what it is there.', ...details].join('\n\n');

  return { text: submission.text, prompt: { ...submission.prompt, text: `${text}\n\n${note}`, images } };
}

function labelsOf(picks: DraftPick[]) {
  const labels = new Map<DraftPick, string>();
  let elements = 0;
  let areas = 0;

  for (const each of picks) labels.set(each, each.pick.kind === 'element' ? `[Element #${++elements}]` : `[Area #${++areas}]`);

  return labels;
}

function describe(pick: PreviewPick, label: string, screenshot: string | undefined) {
  return pick.kind === 'element' ? describeElement(pick, label, screenshot) : describeArea(pick, label, screenshot);
}

function describeElement(pick: ElementPick, label: string, screenshot: string | undefined) {
  const styles = Object.entries(pick.styles).map(([name, value]) => `${name}: ${value}`);

  return [
    `${label}: ${what(pick)}`,
    `On ${pageOf(pick)}, at ${sizeAt(pick.bounds)}.`,
    `Selector: ${pick.selector}`,
    pick.text && `Text: "${pick.text}"`,
    styles.length > 0 && `Styles: ${styles.join('; ')}`,
    `HTML:\n\`\`\`html\n${pick.html}\n\`\`\``,
    screenshot && `Screenshot: ${screenshot}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function describeArea(pick: AreaPick, label: string, screenshot: string | undefined) {
  return [
    `${label}: an area of ${sizeAt(pick.bounds)} on ${pageOf(pick)}.${screenshot ? ` Screenshot: ${screenshot}` : ''}`,
    pick.elements.length > 0 && `Inside it:\n${pick.elements.map((element) => `- ${what(element)}${element.text ? `: "${element.text}"` : ''} (${element.selector})`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** `<button> in PricingCard < Pricing, written in src/pricing.tsx:12`, as far as the page tells. */
function what({ tag, components, source }: Pick<PickedElement, 'tag' | 'components' | 'source'>) {
  return [`<${tag}>`, components.length > 0 && `in ${components.join(' < ')}`, source && `written in ${source}`].filter(Boolean).join(' ');
}

const pageOf = ({ url, viewport }: PreviewPick) => `${url} (viewport ${viewport.width} × ${viewport.height})`;

const sizeAt = ({ x, y, width, height }: PickedElement['bounds']) => `${Math.round(width)} × ${Math.round(height)} at ${Math.round(x)}, ${Math.round(y)}`;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
