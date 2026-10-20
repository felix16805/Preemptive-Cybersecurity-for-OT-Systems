"use client";

import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

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

  useLayoutEffect(() => {
    if (navRef.current) {
      gsap.set(navRef.current, { height: 58, overflow: 'hidden' });
    }
  }, []);

  const openMenu = () => {
    const navEl = navRef.current;
    if (!navEl) return;
    setIsHamburgerOpen(true);
    setIsExpanded(true);
    const validCards = Array.from(navEl.querySelectorAll<HTMLElement>('.nav-card'));
    const targetHeight = calculateHeight();

    gsap.killTweensOf(navEl);
    gsap.killTweensOf(validCards);

    gsap.to(navEl, {
      height: targetHeight,
      duration: prefersReducedMotion ? 0.01 : 0.35,
      ease: ease,
    });

    if (validCards.length > 0) {
      gsap.fromTo(
        validCards,
        { y: prefersReducedMotion ? 0 : 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: prefersReducedMotion ? 0.01 : 0.3,
          stagger: prefersReducedMotion ? 0 : 0.06,
          ease: ease,
          delay: prefersReducedMotion ? 0 : 0.08,
        }
      );
    }
  };

  const closeMenu = () => {
    const navEl = navRef.current;
    if (!navEl) return;
    setIsHamburgerOpen(false);
    setIsExpanded(false);
    const validCards = Array.from(navEl.querySelectorAll<HTMLElement>('.nav-card'));

    gsap.killTweensOf(navEl);
    gsap.killTweensOf(validCards);

    if (validCards.length > 0 && !prefersReducedMotion) {
      gsap.to(validCards, {
        y: 20,
        opacity: 0,
        duration: 0.18,
        ease: 'power2.in',
      });
    }

    gsap.to(navEl, {
      height: 58,
      duration: prefersReducedMotion ? 0.01 : 0.3,
      ease: ease,
    });
  };

  const toggleMenu = () => {
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  // Auto-close whenever pathname changes
  useEffect(() => {
    closeMenu();
  }, [pathname]);

  // Dynamic recalculation on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isExpanded && navRef.current) {
        gsap.to(navRef.current, {
          height: calculateHeight(),
          duration: 0.2,
          ease: 'power2.out',
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isExpanded && navRef.current && !navRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

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

          {/* Simulation (Left of center) */}
          <Link href="/simulation" className="card-nav-signin" style={{ color: menuColor }}>
            Simulation Lab
          </Link>

          {/* Logo wordmark (Center) */}
          <div className="logo-container">
            <Link 
              href="/" 
              className="card-nav-logo" 
              style={{ color: menuColor }}
              onClick={closeMenu}
            >
              {logoText}
            </Link>
          </div>

          {/* Console Button (Right of center) */}
          <Link
            href="/console"
            className="card-nav-signin"
            style={{ color: menuColor }}
          >
            Defender Console
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
                    onClick={closeMenu}
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
