import { expect, test } from 'vitest';
import type { PreviewPick } from '../../../src/main/bridge.js';
import { pickName, withPicks } from '../../../src/renderer/features/preview/pick-prompt.js';

const page = { url: 'http://localhost:5173/pricing', viewport: { width: 1280, height: 800 } };

const button: PreviewPick = {
  kind: 'element',
  ...page,
  tag: 'button',
  components: ['PricingCard', 'Pricing'],
  selector: 'main > div.grid > div:nth-of-type(2) > button',
  text: 'Get Pro',
  html: '<button class="btn">Get Pro</button>',
  styles: { display: 'inline-flex', padding: '8px 16px' },
  bounds: { x: 948.4, y: 410, width: 148, height: 36 },
  image: { mediaType: 'image/png', data: 'BUTTON' },
};

const features: PreviewPick = {
  kind: 'area',
  ...page,
  bounds: { x: 24, y: 380, width: 664, height: 60 },
  image: { mediaType: 'image/png', data: 'AREA' },
  elements: [{ tag: 'span', components: ['FeatureList'], selector: 'ul > li:nth-of-type(1) > span', text: 'Unlimited projects' }],
};

test('names an element by its component, a bare one with its brackets, and areas by number', () => {
  expect(pickName(button, [])).toBe('PricingCard button');
  expect(pickName({ ...button, components: [] }, [])).toBe('<button>');
  expect(pickName(features, [{ name: 'Area 1', pick: features }])).toBe('Area 2');
});

test('sends the picks still named in the text, numbered there, their screenshots after the images', () => {
  const picks = [
    { name: 'PricingCard button', pick: button },
    { name: 'Area 1', pick: features },
    { name: 'Area 2', pick: features },
  ];

  const typed = { text: 'Make PricingCard button wider, see [Image #1]. Area 1 is cramped.', prompt: { text: 'Make PricingCard button wider, see [Image #1]. Area 1 is cramped.', images: [{ mediaType: 'image/png', data: 'PASTED' }] } };
  const { text, prompt } = withPicks(typed, picks);

  expect(text).toBe(typed.text);
  expect(prompt?.text).toMatch(/^Make \[Element #1\] wider, see \[Image #1\]\. \[Area #1\] is cramped\.\n\nI pointed at these/);
  expect(prompt?.text).toContain('[Element #1]: <button> in PricingCard < Pricing\nOn http://localhost:5173/pricing (viewport 1280 × 800), at 148 × 36 at 948, 410.');
  expect(prompt?.text).toContain('Styles: display: inline-flex; padding: 8px 16px');
  expect(prompt?.text).toContain('Screenshot: [Image #2]');
  expect(prompt?.text).toContain('[Area #1]: an area of 664 × 60 at 24, 380 on http://localhost:5173/pricing (viewport 1280 × 800). Screenshot: [Image #3]');
  expect(prompt?.text).toContain('- <span> in FeatureList: "Unlimited projects" (ul > li:nth-of-type(1) > span)');
  expect(prompt?.text).not.toContain('Area #2');
  expect(prompt?.images?.map((image) => image.data)).toEqual(['PASTED', 'BUTTON', 'AREA']);
});

test('leaves a message without picks in it as it is', () => {
  expect(withPicks({ text: 'Hi' }, [{ name: 'Area 1', pick: features }])).toEqual({ text: 'Hi' });
});
