'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { animate, stagger } from 'animejs';

const still = () => typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The motion shared by the booking and online-consultation forms:
 * - the page comes in as a short cascade (switch, title, lede, steps, card);
 * - the card's height eases between steps instead of jumping;
 * - each step slides in from the side it comes from (forward from the right, back from the left),
 *   and its choices follow in a quick stagger.
 */
export function useBookingMotion(root: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>, step: number) {
  const prev = useRef(step);

  useEffect(() => {
    const el = root.current;
    if (!el || still()) return;
    animate(el.querySelectorAll('.bk-top > *, .bk-steps, .bk-card, .bk-after'), { opacity: [0, 1], y: [24, 0], duration: 1100, delay: stagger(70, { start: 80 }), ease: 'outExpo' });
  }, [root]);

  // the card follows its content's height
  useEffect(() => {
    const outer = body.current;
    const inner = outer?.firstElementChild as HTMLElement | null;
    if (!outer || !inner) return;
    const fit = () => { outer.style.height = `${inner.offsetHeight}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [body]);

  useLayoutEffect(() => {
    const dir = step >= prev.current ? 1 : -1;
    const moved = step !== prev.current;
    prev.current = step;
    const pane = body.current?.querySelector('.bk-pane');
    if (!pane || !moved || still()) return;
    animate(pane, { opacity: [0, 1], x: [32 * dir, 0], duration: 650, ease: 'outExpo' });
    animate(pane.querySelectorAll('h2, .opt, .cal, .soonest, .field, .consent, .seg'), { opacity: [0, 1], y: [12, 0], duration: 600, delay: stagger(22, { start: 90 }), ease: 'outExpo' });
  }, [step, body]);
}
