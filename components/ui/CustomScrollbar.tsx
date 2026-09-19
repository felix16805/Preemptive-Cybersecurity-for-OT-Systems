"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTheme } from "@/components/ThemeProvider";
import GhostFibersShell from "@/components/ui/GhostFibersShell";

export default function CustomScrollbar() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const { isLightMode } = useTheme();

  const updateScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    if (!thumbRef.current) return;

    if (scrollHeight <= clientHeight) {
      thumbRef.current.style.height = '0px';
      return;
    }

    const heightPercentage = clientHeight / scrollHeight;
    const height = Math.max(heightPercentage * clientHeight, 40); // min 40px

    const maxScrollTop = scrollHeight - clientHeight;
    const scrollProgress = scrollTop / maxScrollTop;
    const maxThumbTop = clientHeight - height;
    const thumbTop = scrollProgress * maxThumbTop;
    
    // Direct DOM manipulation for zero lag
    thumbRef.current.style.height = `${height}px`;
    thumbRef.current.style.transform = `translate3d(0, ${thumbTop}px, 0)`;

    // Keep it visible if needed
    if (!isDragging) {
      setIsVisible(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      // Optional: hide logic here, but user requested permanently visible, so we skip opacity toggling
    }
  }, [isDragging]);

  useEffect(() => {
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    const timeout = hideTimeoutRef.current;
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, [updateScroll]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    
    // Crucial: Prevent text selection globally while dragging
    document.body.style.userSelect = 'none';

    const startY = e.clientY;
    const startScrollTop = window.scrollY;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault(); 
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      
      if (!thumbRef.current) return;
      const height = parseFloat(thumbRef.current.style.height || "40");
      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = clientHeight - height;

      const deltaY = e.clientY - startY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
      
      window.scrollTo({ top: startScrollTop + scrollDelta, behavior: 'instant' });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = ''; // Restore text selection
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div 
      ref={trackRef}
      className="fixed top-0 right-0 h-full w-[16px] z-[9999]"
    >
      <div 
        ref={thumbRef}
        className={`absolute right-1 top-0 w-[8px] rounded-full overflow-hidden cursor-pointer border ${
          isLightMode 
            ? 'border-[#111318]/30 bg-[#111318]/20' 
            : 'border-[#E0E5FF]/30 bg-[#E0E5FF]/20'
        }`}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}
