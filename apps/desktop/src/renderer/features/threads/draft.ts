import type { Submission } from '../../core/core.js';
import type { DraftImage } from '../../state/app.js';

/** Claude takes images up to 5 MB once encoded, and base64 makes them a third bigger. */
const MAX_BYTES = 3_750_000;

const SHRINK_TO = 2048;

const SUPPORTED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const IMAGES = /\[Image #(\d+)\]/g;

/** The names of the draft's images, which the composer draws as chips where the user put them in the text. */
export function imagePattern(images: DraftImage[]) {
  if (images.length === 0) return undefined;

  // Longest first, so `shot 2.png` isn't taken for `shot.png` and more.
  const names = images.map((image) => image.name).sort((a, b) => b.length - a.length);

  return new RegExp(names.map(escapeRegExp).join('|'));
}

/**
 * The agent reads `[Image #1]` as the first of the images sent, so the names still in the text become those, numbered
 * in the order they stand there; an image whose name was taken out of the text isn't sent.
 */
export function submissionOf(typed: string, images: DraftImage[]): Submission {
  const pattern = imagePattern(images);
  const sent: DraftImage[] = [];

  const text = !pattern
    ? typed.trim()
    : typed.trim().replace(new RegExp(pattern.source, 'g'), (name) => {
        const image = images.find((each) => each.name === name)!;

        if (!sent.includes(image)) sent.push(image);

        return `[Image #${sent.indexOf(image) + 1}]`;
      });

  return sent.length === 0 ? { text } : { text, prompt: { text, images: sent.map(({ mediaType, data }) => ({ mediaType, data })) } };
}

/** A queued message back in the composer, its images named again, apart from the names already in the draft. */
export function draftOf({ text, prompt }: Submission, taken: string[]) {
  const names = [...taken];

  const images = (prompt?.images ?? []).map((image, index) => {
    const name = uniqueName(`Image ${index + 1}.${image.mediaType.split('/')[1] ?? 'png'}`, names);

    names.push(name);

    return { name, ...image };
  });

  return { text: text.replace(IMAGES, (chip, number) => images[Number(number) - 1]?.name ?? chip), images };
}

/** `shot.png`, then `shot 2.png`, `shot 3.png` for more of the same name. */
export function uniqueName(name: string, taken: string[]) {
  const dot = name.lastIndexOf('.');
  const [base, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let candidate = name;

  for (let count = 2; taken.includes(candidate); count++) candidate = `${base} ${count}${extension}`;

  return candidate;
}

export const imageSource = ({ mediaType, data }: Pick<DraftImage, 'mediaType' | 'data'>) => `data:${mediaType};base64,${data}`;

/** Too large or of a kind Claude doesn't read, an image is drawn again as a JPEG no wider than 2048 pixels. */
export async function readImage(file: File): Promise<Omit<DraftImage, 'name'>> {
  const fits = file.size <= MAX_BYTES && SUPPORTED.has(file.type);
  const blob = fits ? file : await redraw(file);

  if (blob.size > MAX_BYTES) throw new Error(`${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB; Claude takes images up to 3.7 MB.`);

  return { mediaType: blob.type, data: await base64(blob) };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function redraw(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} couldn't be read as an image.`);
  });

  const scale = Math.min(1, SHRINK_TO / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));

  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

async function base64(blob: Blob) {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  return url.slice(url.indexOf(',') + 1);
}
