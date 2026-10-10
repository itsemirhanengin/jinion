/** How a piece of the window moves when it changes shape: off at once, settling slowly. */
export const MOTION: KeyframeAnimationOptions = { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
