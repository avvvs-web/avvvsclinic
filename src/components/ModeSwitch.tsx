'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MODES = [
  { href: '/book', label: 'Visit the clinic' },
  { href: '/consult', label: 'Online by video' },
] as const;

/**
 * The Visit / Online switch above the booking forms. The white pill slides to the other side
 * first, then the page changes underneath it, so the switch reads as one control rather than
 * two pages swapping.
 */
export function ModeSwitch({ current }: { current: 0 | 1 }) {
  const router = useRouter();
  const [on, setOn] = useState<number>(current);

  useEffect(() => { MODES.forEach((m) => router.prefetch(m.href)); }, [router]);
  useEffect(() => { setOn(current); }, [current]);

  function go(e: React.MouseEvent<HTMLAnchorElement>, i: number) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (i === current) return;
    setOn(i);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => router.push(MODES[i].href, { scroll: false }), still ? 0 : 380);
  }

  return (
    <p className="choice" data-on={on}>
      {MODES.map((m, i) => (
        <Link key={m.href} href={m.href} className={on === i ? 'on' : undefined}
          aria-current={current === i ? 'page' : undefined} onClick={(e) => go(e, i)}>
          {m.label}
        </Link>
      ))}
    </p>
  );
}
