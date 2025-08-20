import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimeoutProps {
  onIdle: () => void;
  idleTime?: number; // in milliseconds
  events?: string[];
}

export const useIdleTimeout = ({ 
  onIdle, 
  idleTime = 10 * 60 * 1000, // 10 minutes default
  events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
}: UseIdleTimeoutProps) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const eventHandlerRef = useRef<() => void>();

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onIdle();
    }, idleTime);
  }, [onIdle, idleTime]);

  const handleActivity = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  useEffect(() => {
    eventHandlerRef.current = handleActivity;
    
    // Set initial timeout
    resetTimeout();

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      // Cleanup timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [handleActivity, resetTimeout, events]);

  // Clean up on unmount or when callback changes
  useEffect(() => {
    eventHandlerRef.current = handleActivity;
  }, [handleActivity]);
};