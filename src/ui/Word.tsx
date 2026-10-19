import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { focusParts } from '../engine/text';

export function Word({ word, fontSize }: { word: string; fontSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fontSize);
  const parts = focusParts(word);
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    function fit() {
      if (!stage || !context) return;
      const style = getComputedStyle(stage);
      context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
      const [left, focus, right] = focusParts(word);
      const required =
        2 * Math.max(context.measureText(left).width, context.measureText(right).width) +
        context.measureText(focus).width;
      setSize(Math.min(fontSize, (fontSize * (stage.clientWidth - 24)) / Math.max(1, required)));
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [word, fontSize]);
  return (
    <div
      ref={ref}
      className="stage"
      style={{ '--reader-font-size': `${size}px` } as CSSProperties}
      aria-live="off"
    >
      <span>{parts[0]}</span>
      <span>{parts[1]}</span>
      <span>{parts[2]}</span>
    </div>
  );
}
