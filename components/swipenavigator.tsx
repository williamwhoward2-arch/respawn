"use client";

import { useRef, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";

type RouteKey = "/dashboard" | "/Progress" | "/Profile" | "/Workout";

const ORDER: RouteKey[] = ["/dashboard", "/Progress", "/Profile", "/Workout"];

type SwipeNavigatorProps = {
  current: RouteKey;
  children: ReactNode;
  disabled?: boolean;
};

export default function SwipeNavigator({
  current,
  children,
  disabled = false,
}: SwipeNavigatorProps) {
  const router = useRouter();

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startedOnInteractiveRef = useRef(false);

  function isInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest(
        'input, textarea, select, button, a, [role="button"], [data-no-swipe="true"]'
      )
    );
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (disabled) return;

    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    startedOnInteractiveRef.current = isInteractiveTarget(e.target);
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (disabled) return;
    if (startedOnInteractiveRef.current) return;
    if (startXRef.current === null || startYRef.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    startXRef.current = null;
    startYRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Strong guard so vertical scrolling doesn't trigger route changes
    if (absX < 90) return;
    if (absY > 60) return;
    if (absX <= absY) return;

    const currentIndex = ORDER.indexOf(current);
    if (currentIndex === -1) return;

    if (deltaX < 0) {
      const next = ORDER[currentIndex + 1];
      if (next) router.push(next);
      return;
    }

    if (deltaX > 0) {
      const prev = ORDER[currentIndex - 1];
      if (prev) router.push(prev);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}