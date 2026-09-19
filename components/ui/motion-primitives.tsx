"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import React, { useRef, useState, useEffect } from "react";

interface Props extends React.ComponentPropsWithoutRef<"button"> {
  children: React.ReactNode;
  active?: boolean;
}

export function MagneticButton({ children, className, ...props }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isReducedMotion) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current!.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    // Cap displacement
    x.set(middleX * 0.2);
    y.set(middleY * 0.2);
  };

  const handleMouseLeave = () => {
    if (isReducedMotion) return;
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: isReducedMotion ? 1 : 0.97 }}
      style={{
        x: isReducedMotion ? 0 : smoothX,
        y: isReducedMotion ? 0 : smoothY,
      }}
      className={`relative ${className || ""}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

export function PressFeedback({ children, className, as: Component = "div", ...props }: any) {
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);
  }, []);

  const MotionComponent = motion.create(Component as any);

  return (
    <MotionComponent
      whileTap={{ scale: isReducedMotion ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
      {...(props as any)}
    >
      {children}
    </MotionComponent>
  );
}
