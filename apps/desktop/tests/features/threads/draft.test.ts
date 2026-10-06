import { expect, test } from 'vitest';
import { draftOf, submissionOf, uniqueName } from '../../../src/renderer/features/threads/draft.js';

const image = (name: string) => ({ name, mediaType: 'image/png', data: `data of ${name}` });

test('sends the images still named in the text, in the order they stand there, as [Image #n]', () => {
  const submission = submissionOf('after shot 2.png see shot.png, and shot 2.png again ', [image('shot.png'), image('unused.png'), image('shot 2.png')]);

  expect(submission).toEqual({
    text: 'after [Image #1] see [Image #2], and [Image #1] again',
    prompt: {
      text: 'after [Image #1] see [Image #2], and [Image #1] again',
      images: [
        { mediaType: 'image/png', data: 'data of shot 2.png' },
        { mediaType: 'image/png', data: 'data of shot.png' },
      ],
    },
  });
});

test('sends plain text when no image is named in it', () => {
  expect(submissionOf('look at it', [image('shot.png')])).toEqual({ text: 'look at it' });
});

test('names an image apart from another of the same name', () => {
  expect(uniqueName('shot.png', ['shot.png', 'shot 2.png'])).toBe('shot 3.png');
  expect(uniqueName('shot.png', [])).toBe('shot.png');
});

test('brings a queued message back with its images named apart from those already in the draft', () => {
  const { text, images } = draftOf(submissionOf('a.png then b.png', [image('a.png'), image('b.png')]), ['Image 1.png']);

  expect(text).toBe('Image 1 2.png then Image 2.png');

  expect(images.map(({ name, data }) => [name, data])).toEqual([
    ['Image 1 2.png', 'data of a.png'],
    ['Image 2.png', 'data of b.png'],
  ]);
});
