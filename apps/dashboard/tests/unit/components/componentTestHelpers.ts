import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

// Test wrapper components and providers
interface AllTheProvidersProps {
  children: ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  // Add any providers here that your components might need
  // For example: ThemeProvider, QueryClient, etc.
  return <>{children}</>;
};

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from testing-library/react
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Helper functions for common test patterns

// Wait for loading states to complete
export const waitForLoadingToComplete = async () => {
  // Wait for any loading spinners, skeleton loaders, etc. to disappear
  await new Promise(resolve => setTimeout(resolve, 100));
};

// Mock window resize for responsive testing
export const mockWindowResize = (width: number, height: number = 768) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

// Mock IntersectionObserver for components that use it
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
};

// Mock ResizeObserver for components that use it
export const mockResizeObserver = () => {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
  window.ResizeObserver = mockResizeObserver;
  return mockResizeObserver;
};

// Mock matchMedia for responsive components
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Mock URL methods for file download testing
export const mockURLMethods = () => {
  const mockCreateObjectURL = vi.fn(() => 'mock-url');
  const mockRevokeObjectURL = vi.fn();
  
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  
  return { mockCreateObjectURL, mockRevokeObjectURL };
};

// Mock document methods for DOM manipulation testing
export const mockDocumentMethods = () => {
  const mockClick = vi.fn();
  const mockAppendChild = vi.fn();
  const mockRemoveChild = vi.fn();
  
  const mockAnchor = {
    href: '',
    download: '',
    click: mockClick,
  };
  
  vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  
  return { mockClick, mockAppendChild, mockRemoveChild, mockAnchor };
};

// Helper to trigger file download in tests
export const triggerFileDownload = (data: any, filename: string = 'test-file.json') => {
  const { mockCreateObjectURL, mockRevokeObjectURL } = mockURLMethods();
  const { mockClick } = mockDocumentMethods();
  
  return {
    expectDownload: () => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    },
    mockCreateObjectURL,
    mockRevokeObjectURL,
    mockClick,
  };
};

// Mock console methods to avoid noise in tests
export const mockConsole = () => {
  const originalConsole = { ...console };
  const mockLog = vi.fn();
  const mockWarn = vi.fn();
  const mockError = vi.fn();
  
  console.log = mockLog;
  console.warn = mockWarn;
  console.error = mockError;
  
  return {
    mockLog,
    mockWarn,
    mockError,
    restore: () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    },
  };
};

// Helper for testing error boundaries
export const TestErrorBoundary = ({ children, onError }: { 
  children: ReactNode; 
  onError?: (error: Error) => void;
}) => {
  try {
    return <>{children}</>;
  } catch (error) {
    onError?.(error as Error);
    return <div data-testid="error-boundary">Error occurred</div>;
  }
};

// Helper for testing lazy loading
export const waitForLazyLoad = async (testId: string, timeout: number = 5000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (element) return element;
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element with testId "${testId}" not found within ${timeout}ms`);
};

// Performance testing helper
export const measureRenderTime = (renderFn: () => void) => {
  const startTime = performance.now();
  renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

// Accessibility testing helpers
export const getByTestId = (container: HTMLElement, testId: string) => {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Element with testId "${testId}" not found`);
  }
  return element as HTMLElement;
};

export const getAllByTestId = (container: HTMLElement, testId: string) => {
  const elements = container.querySelectorAll(`[data-testid="${testId}"]`);
  return Array.from(elements) as HTMLElement[];
};

// Form testing helpers
export const fillForm = async (form: HTMLFormElement, data: Record<string, string>) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  
  for (const [name, value] of Object.entries(data)) {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
    if (input) {
      await user.clear(input);
      await user.type(input, value);
    }
  }
};

// Tab testing helper
export const expectTabToBeActive = (tabElement: HTMLElement, isActive: boolean = true) => {
  if (isActive) {
    expect(tabElement).toHaveAttribute('aria-selected', 'true');
  } else {
    expect(tabElement).toHaveAttribute('aria-selected', 'false');
  }
};

// Chart testing helpers (for Recharts components)
export const mockChartComponents = () => {
  return {
    LineChart: ({ children, ...props }: any) => (
      <div data-testid="line-chart" {...props}>{children}</div>
    ),
    Line: (props: any) => <div data-testid="line" {...props} />,
    AreaChart: ({ children, ...props }: any) => (
      <div data-testid="area-chart" {...props}>{children}</div>
    ),
    Area: (props: any) => <div data-testid="area" {...props} />,
    BarChart: ({ children, ...props }: any) => (
      <div data-testid="bar-chart" {...props}>{children}</div>
    ),
    Bar: (props: any) => <div data-testid="bar" {...props} />,
    PieChart: ({ children, ...props }: any) => (
      <div data-testid="pie-chart" {...props}>{children}</div>
    ),
    Pie: (props: any) => <div data-testid="pie" {...props} />,
    Cell: (props: any) => <div data-testid="cell" {...props} />,
    XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
    YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
    CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
    Tooltip: (props: any) => <div data-testid="tooltip" {...props} />,
    ResponsiveContainer: ({ children, ...props }: any) => (
      <div data-testid="responsive-container" {...props}>{children}</div>
    ),
  };
};

// Mock UI components for testing
export const mockUIComponents = () => {
  return {
    Card: ({ children, ...props }: any) => (
      <div data-testid="card" {...props}>{children}</div>
    ),
    CardContent: ({ children, ...props }: any) => (
      <div data-testid="card-content" {...props}>{children}</div>
    ),
    CardHeader: ({ children, ...props }: any) => (
      <div data-testid="card-header" {...props}>{children}</div>
    ),
    CardTitle: ({ children, ...props }: any) => (
      <h3 data-testid="card-title" {...props}>{children}</h3>
    ),
    CardDescription: ({ children, ...props }: any) => (
      <p data-testid="card-description" {...props}>{children}</p>
    ),
    Button: ({ children, onClick, disabled, ...props }: any) => (
      <button 
        data-testid="button" 
        onClick={onClick} 
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    ),
    Input: ({ value, onChange, ...props }: any) => (
      <input 
        data-testid="input" 
        value={value} 
        onChange={onChange}
        {...props}
      />
    ),
    Select: ({ children, value, onValueChange, ...props }: any) => (
      <select 
        data-testid="select" 
        value={value} 
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      >
        {children}
      </select>
    ),
    SelectContent: ({ children, ...props }: any) => (
      <div data-testid="select-content" {...props}>{children}</div>
    ),
    SelectItem: ({ children, value, ...props }: any) => (
      <option data-testid="select-item" value={value} {...props}>{children}</option>
    ),
    SelectTrigger: ({ children, ...props }: any) => (
      <div data-testid="select-trigger" {...props}>{children}</div>
    ),
    SelectValue: ({ placeholder, ...props }: any) => (
      <span data-testid="select-value" {...props}>{placeholder}</span>
    ),
    Badge: ({ children, variant, ...props }: any) => (
      <span data-testid="badge" data-variant={variant} {...props}>{children}</span>
    ),
    Progress: ({ value, ...props }: any) => (
      <div data-testid="progress" data-value={value} {...props}>
        <div style={{ width: `${value}%` }} />
      </div>
    ),
    ScrollArea: ({ children, ...props }: any) => (
      <div data-testid="scroll-area" {...props}>{children}</div>
    ),
    Alert: ({ children, ...props }: any) => (
      <div data-testid="alert" {...props}>{children}</div>
    ),
    AlertDescription: ({ children, ...props }: any) => (
      <div data-testid="alert-description" {...props}>{children}</div>
    ),
    Tabs: ({ children, value, onValueChange, ...props }: any) => (
      <div data-testid="tabs" data-value={value} {...props}>{children}</div>
    ),
    TabsContent: ({ children, value, ...props }: any) => (
      <div data-testid="tabs-content" data-value={value} {...props}>{children}</div>
    ),
    TabsList: ({ children, ...props }: any) => (
      <div data-testid="tabs-list" {...props}>{children}</div>
    ),
    TabsTrigger: ({ children, value, onClick, ...props }: any) => (
      <button 
        data-testid="tabs-trigger" 
        data-value={value} 
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    ),
  };
};

// Test data validation helpers
export const expectValidTrace = (trace: any) => {
  expect(trace).toHaveProperty('id');
  expect(trace).toHaveProperty('name');
  expect(trace).toHaveProperty('sessionId');
  expect(trace).toHaveProperty('timestamp');
  expect(trace).toHaveProperty('status');
  expect(trace.status).toMatch(/^(success|error|pending|running)$/);
};

export const expectValidAgent = (agent: any) => {
  expect(agent).toHaveProperty('id');
  expect(agent).toHaveProperty('name');
  expect(agent).toHaveProperty('status');
  expect(agent.status).toMatch(/^(active|idle|error|offline)$/);
  expect(agent).toHaveProperty('tasksCompleted');
  expect(agent).toHaveProperty('averageResponseTime');
};

export const expectValidMetrics = (metrics: any) => {
  expect(metrics).toHaveProperty('totalTraces');
  expect(metrics).toHaveProperty('activeTraces');
  expect(metrics).toHaveProperty('totalAgents');
  expect(metrics).toHaveProperty('activeAgents');
  expect(metrics).toHaveProperty('errorRate');
  expect(metrics).toHaveProperty('tokenUsage');
  expect(metrics.tokenUsage).toHaveProperty('total');
};