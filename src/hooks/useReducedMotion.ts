import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reducedMotion = false;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | null = null;
const listeners = new Set<() => void>();

function updateReducedMotion(nextValue: boolean) {
  if (reducedMotion === nextValue) return;
  reducedMotion = nextValue;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    void AccessibilityInfo.isReduceMotionEnabled().then(updateReducedMotion);
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateReducedMotion);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

const getSnapshot = () => reducedMotion;

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
