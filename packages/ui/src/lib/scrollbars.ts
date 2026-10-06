/** How long a scrollbar stays after its area stops scrolling. */
const LINGER = 900;

/** How wide the strip along an edge is where the pointer shows the scrollbar, the scrollbar's own width. */
const STRIP = 10;

/**
 * Shows each scrollbar, as macOS does, only while its area scrolls or the pointer is over its strip: marks the element
 * with `data-scrolling` or `data-scrollbar-hover`, which the theme draws the thumb for. Once for the page.
 */
export function followScrollbars() {
  const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  let hovered: Element | undefined;

  addEventListener(
    'scroll',
    ({ target }) => {
      const element = target instanceof Element ? target : document.scrollingElement;
      if (!element) return;

      element.setAttribute('data-scrolling', '');
      clearTimeout(timers.get(element));

      timers.set(
        element,
        setTimeout(() => element.removeAttribute('data-scrolling'), LINGER),
      );
    },
    { capture: true, passive: true },
  );

  addEventListener(
    'pointermove',
    ({ clientX, clientY, target }) => {
      const element = target instanceof Element ? stripUnder(target, clientX, clientY) : undefined;
      if (element === hovered) return;

      hovered?.removeAttribute('data-scrollbar-hover');
      element?.setAttribute('data-scrollbar-hover', '');
      hovered = element;
    },
    { passive: true },
  );
}

/** The scrolling element, from `target` up, whose scrollbar strip is under the pointer. */
function stripUnder(target: Element, x: number, y: number) {
  for (let element: Element | null = target; element; element = element.parentElement) {
    const box = element.getBoundingClientRect();
    const vertical = element.scrollHeight > element.clientHeight && x >= box.right - STRIP && x <= box.right;
    const horizontal = element.scrollWidth > element.clientWidth && y >= box.bottom - STRIP && y <= box.bottom;

    if ((vertical || horizontal) && scrolls(element)) return element;
  }

  return undefined;
}

function scrolls(element: Element) {
  const { overflowX, overflowY } = getComputedStyle(element);

  return /auto|scroll/.test(overflowX) || /auto|scroll/.test(overflowY);
}
