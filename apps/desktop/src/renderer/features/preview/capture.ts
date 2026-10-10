import { useEffect, useState } from 'react';
import type { Core } from '../../core/core.js';
import { bridgeKey } from './previews.js';

/** How often a preview's picture is taken again. */
const EVERY = 5000;

/** A picture of the preview's page, taken again every few seconds; none while the page isn't drawn. */
export function useCapture(core: Core, id: string | undefined) {
  const [image, setImage] = useState<string>();

  useEffect(() => {
    if (!id) return setImage(undefined);

    // An empty capture, of a page that isn't drawn, comes back as a data URL with nothing after its header.
    const take = () => void window.desktop.preview.capture(bridgeKey(core, id)).then((url) => setImage(url.length > 100 ? url : undefined), () => {});
    const timer = setInterval(take, EVERY);

    take();

    return () => clearInterval(timer);
  }, [core, id]);

  return image;
}
