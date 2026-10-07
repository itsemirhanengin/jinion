const ESCAPES = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

const LOCAL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost)(?::\d{1,5})?(?:\/[^\s'"<>`)\]\\]*)?/g;

/**
 * The local addresses in what a terminal wrote, as dev servers print them: escape codes taken out first, since Vite
 * prints the port in bold. One that ends the text may still be coming, so it waits for what follows it.
 */
export function localUrls(output: string) {
  const text = output.replace(ESCAPES, '');
  const urls: string[] = [];

  for (const match of text.matchAll(LOCAL)) {
    if (match.index + match[0].length === text.length) continue;

    const url = tidy(match[0]);

    if (!urls.includes(url)) urls.push(url);
  }

  return urls;
}

/** `0.0.0.0` is where a server listens, not an address to open; a closing dot or comma is the sentence's. */
function tidy(found: string) {
  const url = new URL(found.replace(/[.,;:]+$/, ''));

  if (url.hostname === '0.0.0.0') url.hostname = 'localhost';

  return url.pathname === '/' && !url.search ? url.origin : url.href;
}
