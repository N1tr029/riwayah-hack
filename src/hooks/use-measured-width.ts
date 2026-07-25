import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

/**
 * Width of a container, via onLayout with an imperative measure() fallback.
 * On web, screens presented as modals can mount without ever firing onLayout
 * (react-native-screens quirk) — the polling fallback covers that case, then
 * stops as soon as a real width arrives.
 */
export function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const ref = useRef<View>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  useEffect(() => {
    if (width > 0) return;
    const poll = setInterval(() => {
      ref.current?.measure?.((_x, _y, w) => {
        if (w > 0) setWidth((prev) => (prev > 0 ? prev : w));
      });
    }, 120);
    const stop = setTimeout(() => clearInterval(poll), 2000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [width]);

  return { ref, width, onLayout };
}
