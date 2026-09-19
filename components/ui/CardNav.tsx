"use client";

import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import Link from 'next/link';
import './CardNav.css';

interface NavLink {
  label: string;
  href: string;
  ariaLabel?: string;
}

interface CardNavItem {
  label: string;
  bgColor: string;
  textColor: string;
  links?: NavLink[];
}

interface CardNavProps {
  logoText?: string;
  logoAlt?: string;
  items: CardNavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  themeToggle?: React.ReactNode;
}

const CardNav = ({
  logoText = 'SafeCut',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#F5F3EE',
  menuColor = '#111318',
  buttonBgColor = '#C8862B',
  buttonTextColor = '#111318',
  themeToggle,
}: CardNavProps) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
      if (contentEl) {
        const wasVis = contentEl.style.visibility;
        const wasPtr = contentEl.style.pointerEvents;
        const wasPos = contentEl.style.position;
        const wasH = contentEl.style.height;
        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';
        contentEl.offsetHeight;
        const h = 60 + contentEl.scrollHeight + 16;
        contentEl.style.visibility = wasVis;
        contentEl.style.pointerEvents = wasPtr;
        contentEl.style.position = wasPos;
        contentEl.style.height = wasH;
        return h;
      }
    }
    return 260;
  };

  const createTimeline = (reduced: boolean) => {
    const navEl = navRef.current;
    if (!navEl) return null;
    const validCards = cardsRef.current.filter(Boolean);
    gsap.set(navEl, { height: 58, overflow: 'hidden' });
    gsap.set(validCards, { y: reduced ? 0 : 50, opacity: 0 });
    const dur = reduced ? 0.01 : 0.4;
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: dur, ease: reduced ? 'none' : ease });
    tl.to(validCards, { y: 0, opacity: 1, duration: dur, ease: reduced ? 'none' : ease, stagger: reduced ? 0 : 0.08 }, '-=0.1');
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline(prefersReducedMotion);
    tlRef.current = tl;
    return () => { tl?.kill(); tlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items, prefersReducedMotion]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        const newH = calculateHeight();
        gsap.set(navRef.current, { height: newH });
        tlRef.current.kill();
        const newTl = createTimeline(prefersReducedMotion);
        if (newTl) { newTl.progress(1); tlRef.current = newTl; }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline(prefersReducedMotion);
        if (newTl) tlRef.current = newTl;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, prefersReducedMotion]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el;
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''}`}
        style={{ backgroundColor: baseColor }}
      >
        <div className="card-nav-top">
          {/* Hamburger */}
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
            }}
            role="button"
            aria-label={isExpanded ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isExpanded}
            tabIndex={0}
            style={{ color: menuColor }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          {/* Defender Sign In (Left of center) */}
          <Link href="/console" className="card-nav-signin" style={{ color: menuColor }}>
            Defender Sign In
          </Link>

          {/* Logo wordmark (Center) */}
          <div className="logo-container">
            <Link 
              href="/" 
              className="card-nav-logo" 
              style={{ color: menuColor }}
              onClick={() => {
                if (isExpanded) {
                  setIsHamburgerOpen(false);
                  tlRef.current?.eventCallback('onReverseComplete', () => setIsExpanded(false));
                  tlRef.current?.reverse();
                }
              }}
            >
              {logoText}
            </Link>
          </div>

          {/* Request Session (Right of center) */}
          <Link
            href="/contact"
            className="card-nav-signin"
            style={{ color: menuColor }}
          >
            Request Session
          </Link>

          {/* Theme Toggle (Right edge) */}
          <div className="theme-toggle-container">
            {themeToggle}
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links?.map((lnk, i) => (
                  <Link
                    key={`${lnk.label}-${i}`}
                    className="nav-card-link"
                    href={lnk.href}
                    aria-label={lnk.ariaLabel}
                    onClick={() => { setIsHamburgerOpen(false); tlRef.current?.eventCallback('onReverseComplete', () => setIsExpanded(false)); tlRef.current?.reverse(); }}
                  >
                    <svg className="nav-card-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M3 13L13 3M13 3H6M13 3V10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {lnk.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
