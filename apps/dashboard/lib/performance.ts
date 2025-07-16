// Performance optimization utilities for the React dashboard

/**
 * Debounce function to limit the rate at which a function can fire
 * Useful for search inputs and API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function to ensure a function doesn't fire more than once per interval
 * Useful for scroll events and real-time updates
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Lazy load components with retry logic
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  maxRetries: number = 3
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await componentImport();
      } catch (error) {
        retries++;
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
      }
    }
    
    throw new Error('Failed to load component after retries');
  });
}

/**
 * Virtual scrolling helper for large lists
 */
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const { itemHeight, containerHeight, overscan = 5 } = options;
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );
  
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  return {
    visibleItems,
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    setScrollTop
  };
}

/**
 * Memory-efficient state management for large datasets
 */
export function useLRUCache<K, V>(maxSize: number = 100) {
  const cache = React.useRef(new Map<K, V>());
  
  const get = React.useCallback((key: K): V | undefined => {
    const item = cache.current.get(key);
    if (item) {
      // Move to end (most recently used)
      cache.current.delete(key);
      cache.current.set(key, item);
    }
    return item;
  }, []);
  
  const set = React.useCallback((key: K, value: V): void => {
    if (cache.current.has(key)) {
      cache.current.delete(key);
    } else if (cache.current.size >= maxSize) {
      // Remove least recently used item
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
    cache.current.set(key, value);
  }, [maxSize]);
  
  const clear = React.useCallback((): void => {
    cache.current.clear();
  }, []);
  
  return { get, set, clear, size: cache.current.size };
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      options
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [elementRef, options]);
  
  return isIntersecting;
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  startTiming(label: string): void {
    performance.mark(`${label}-start`);
  }
  
  endTiming(label: string): number {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    
    const measure = performance.getEntriesByName(label, 'measure')[0];
    const duration = measure?.duration || 0;
    
    // Store metrics
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    const timings = this.metrics.get(label)!;
    timings.push(duration);
    
    // Keep only last 100 measurements
    if (timings.length > 100) {
      timings.shift();
    }
    
    return duration;
  }
  
  getAverageTime(label: string): number {
    const timings = this.metrics.get(label) || [];
    if (timings.length === 0) return 0;
    
    return timings.reduce((sum, time) => sum + time, 0) / timings.length;
  }
  
  getPercentile(label: string, percentile: number): number {
    const timings = this.metrics.get(label) || [];
    if (timings.length === 0) return 0;
    
    const sorted = [...timings].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index] || 0;
  }
  
  getAllMetrics(): Record<string, { avg: number; p50: number; p95: number; p99: number }> {
    const result: Record<string, { avg: number; p50: number; p95: number; p99: number }> = {};
    
    for (const [label] of this.metrics) {
      result[label] = {
        avg: this.getAverageTime(label),
        p50: this.getPercentile(label, 50),
        p95: this.getPercentile(label, 95),
        p99: this.getPercentile(label, 99)
      };
    }
    
    return result;
  }
}

/**
 * Bundle size optimization utilities
 */
export const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export const loadCSS = (href: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });
};

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): Record<string, number> | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Network information
 */
export function getNetworkInfo(): Record<string, any> | null {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }
  return null;
}