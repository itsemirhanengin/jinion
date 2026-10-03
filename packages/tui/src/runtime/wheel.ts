import { createContext, useContext, useEffect, type RefObject } from 'react';
import type { DOMElement } from 'ink';
import { contains, screenRect } from './click.js';
import { useMouse } from './mouse.js';

type Zone = RefObject<DOMElement | null>;

export const WheelZonesContext = createContext<Set<Zone>>(new Set());

/** The wheel over `ref` scrolls it, and nothing that would otherwise take the wheel, such as the conversation. */
export function useWheelZone(ref: Zone, onWheel: (direction: 'up' | 'down') => void, { isActive = true }: { isActive?: boolean } = {}) {
  const zones = useContext(WheelZonesContext);

  useEffect(() => {
    if (!isActive) return;

    zones.add(ref);

    return () => void zones.delete(ref);
  }, [zones, ref, isActive]);

  useMouse(
    (event) => {
      if (event.type === 'wheel' && ref.current && contains(screenRect(ref.current), event.x, event.y)) onWheel(event.direction);
    },
    { isActive },
  );
}

export function useWheelClaimed() {
  const zones = useContext(WheelZonesContext);

  return (x: number, y: number) => [...zones].some((zone) => zone.current !== null && contains(screenRect(zone.current), x, y));
}
