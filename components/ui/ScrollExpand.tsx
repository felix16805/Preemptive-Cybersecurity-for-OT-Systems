"use client";

import { useRef, useEffect, useState, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollExpand.css';

gsap.registerPlugin(ScrollTrigger);

interface ScrollExpandProps {
  children?: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  scrollDuration?: string;
  expandRatio?: number;
  className?: string;
}

export default function ScrollExpand({
  children,
  imageUrl,
  imageAlt = 'Scroll Expand Image',
  scrollDuration = '150%',
  expandRatio = 0.8,
  className = ''
}: ScrollExpandProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const centerBlockRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!trackRef.current || !centerBlockRef.current || !mediaRef.current) return;
    
    if (isReducedMotion) {
      gsap.set(centerBlockRef.current, { width: '100%', height: '100%', borderRadius: '0px' });
      gsap.set(mediaRef.current, { scale: 1 });
      return; // disable scroll expansion
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: trackRef.current,
          start: 'top top',
          end: `+=${scrollDuration}`,
          scrub: true,
          pin: true,
        }
      });

      tl.to(centerBlockRef.current, {
        width: '100%',
        height: '100%',
        borderRadius: '0px',
        ease: 'none'
      }, 0)
      .to(mediaRef.current, {
        scale: 1,
        ease: 'none'
      }, 0);
    });

    return () => ctx.revert();
  }, [scrollDuration, isReducedMotion]);

  const hasImage = Boolean(imageUrl);

  return (
    <div className={`scroll-expand-container ${className}`} ref={containerRef}>
      <div className="scroll-expand-track" ref={trackRef}>
        {/* The pinning background / content behind the expanding block */}
        <div className="scroll-expand-bg">
          {children}
        </div>
        
        <div 
          className="scroll-expand-centerBlock" 
          ref={centerBlockRef}
          style={{ 
            width: isReducedMotion ? '100%' : `${expandRatio * 100}%`, 
            height: isReducedMotion ? '100%' : `${expandRatio * 100}%` 
          }}
        >
          {hasImage && (
            <div className="scroll-expand-mediaWrap">
              <div 
                className="scroll-expand-media" 
                ref={mediaRef}
                style={{ scale: isReducedMotion ? 1 : 1 + (1 - expandRatio) }}
              >
                <img src={imageUrl} alt={imageAlt} className="scroll-expand-image" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
