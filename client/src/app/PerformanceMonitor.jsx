import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const ROUTE_NAVIGATION_START_MARK = 'applypilot:route-navigation-start';

export default function PerformanceMonitor() {
  const location = useLocation();
  const initialRender = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return undefined;
    const route = `${location.pathname}${location.search}`;
    const startedAt = performance.getEntriesByName(ROUTE_NAVIGATION_START_MARK, 'mark').at(-1)?.startTime
      ?? performance.now();
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const duration = performance.now() - startedAt;
        window.dispatchEvent(new CustomEvent('applypilot:route-performance', {
          detail: { duration, initial: initialRender.current, route },
        }));
        initialRender.current = false;
        performance.clearMarks(ROUTE_NAVIGATION_START_MARK);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [location.key, location.pathname, location.search]);

  useEffect(() => observeWebVitals(), []);

  return null;
}

export function markRouteNavigationStart() {
  if (typeof performance === 'undefined') return;
  performance.mark(ROUTE_NAVIGATION_START_MARK);
}

function observeWebVitals() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return undefined;
  const observers = [];
  let latestLcp = 0;
  let longestInteraction = 0;

  if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
    const observer = new PerformanceObserver((list) => {
      latestLcp = list.getEntries().at(-1)?.startTime || latestLcp;
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(observer);
  }

  if (PerformanceObserver.supportedEntryTypes?.includes('event')) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId) longestInteraction = Math.max(longestInteraction, entry.duration);
      }
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    observers.push(observer);
  }

  const report = () => {
    if (latestLcp) reportWebVital('LCP', latestLcp);
    if (longestInteraction) reportWebVital('INP', longestInteraction);
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') report();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', report);

  return () => {
    observers.forEach((observer) => observer.disconnect());
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', report);
  };
}

function reportWebVital(name, value) {
  window.dispatchEvent(new CustomEvent('applypilot:web-vital', { detail: { name, value } }));
}
