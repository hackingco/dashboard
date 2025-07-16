import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { RealTimeTracingDashboard } from '../../../components/observability/RealTimeTracingDashboard';

// Mock the useLangfuseRealtime hook
vi.mock('../../../lib/hooks/use-langfuse-realtime', () => ({
  useLangfuseRealtime: vi.fn(),
}));

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => <div data-testid="line-chart" {...props}>{children}</div>,
  Line: (props: any) => <div data-testid="line" {...props} />,
  AreaChart: ({ children, ...props }: any) => <div data-testid="area-chart" {...props}>{children}</div>,
  Area: (props: any) => <div data-testid="area" {...props} />,
  BarChart: ({ children, ...props }: any) => <div data-testid="bar-chart" {...props}>{children}</div>,
  Bar: (props: any) => <div data-testid="bar" {...props} />,
  PieChart: ({ children, ...props }: any) => <div data-testid="pie-chart" {...props}>{children}</div>,
  Pie: (props: any) => <div data-testid="pie" {...props} />,
  Cell: (props: any) => <div data-testid="cell" {...props} />,
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: (props: any) => <div data-testid="tooltip" {...props} />,
  ResponsiveContainer: ({ children, ...props }: any) => <div data-testid="responsive-container" {...props}>{children}</div>,
}));

// Mock UI components
vi.mock('../../../components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => <div data-testid="tabs" {...props}>{children}</div>,
  TabsContent: ({ children, ...props }: any) => <div data-testid="tabs-content" {...props}>{children}</div>,
  TabsList: ({ children, ...props }: any) => <div data-testid="tabs-list" {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button data-testid="tabs-trigger" {...props}>{children}</button>,
}));

const mockTrace = {
  id: 'trace-1',
  name: 'Test Trace',
  sessionId: 'session-1',
  userId: 'user-1',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  duration: 1500,
  status: 'success' as const,
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50,
  totalCost: 0.003,
  input: 'Test input prompt',
  output: 'Test output response',
  metadata: { agentId: 'agent-1', temperature: 0.7 },
  tags: ['test', 'automation'],
  scores: { quality: 0.95, relevance: 0.88 },
  memoryUsage: 256,
  cpuUsage: 45,
  agentId: 'agent-1',
  swarmId: 'swarm-1',
};

const mockAgent = {
  id: 'agent-1',
  name: 'Test Agent',
  status: 'active' as const,
  currentTask: 'Processing data',
  tasksCompleted: 25,
  averageResponseTime: 800,
  memoryUsage: 65,
  cpuUsage: 35,
  lastActivity: new Date('2024-01-01T10:00:00Z'),
  swarmId: 'swarm-1',
};

const mockMetrics = {
  totalTraces: 100,
  activeTraces: 5,
  totalAgents: 8,
  activeAgents: 6,
  totalTasks: 150,
  completedTasks: 140,
  failedTasks: 5,
  averageResponseTime: 1200,
  throughput: 25,
  errorRate: 3.3,
  totalCost: 0.45,
  tokenUsage: {
    prompt: 5000,
    completion: 3000,
    total: 8000,
  },
};

const defaultMockHookReturn = {
  traces: [mockTrace],
  agents: [mockAgent],
  metrics: mockMetrics,
  isConnected: true,
  isInitializing: false,
  error: null,
  recentActivity: 2,
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  refresh: vi.fn(),
  clearTraces: vi.fn(),
};

describe('RealTimeTracingDashboard', () => {
  let mockUseLangfuseRealtime: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useLangfuseRealtime } = await import('../../../lib/hooks/use-langfuse-realtime');
    mockUseLangfuseRealtime = vi.mocked(useLangfuseRealtime);
    mockUseLangfuseRealtime.mockReturnValue(defaultMockHookReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders the dashboard with default props', () => {
      render(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('Real-Time Swarm Tracing Dashboard')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument(); // Active agents
      expect(screen.getByText('140')).toBeInTheDocument(); // Completed tasks
      expect(screen.getByText('1200ms')).toBeInTheDocument(); // Avg response time
    });

    it('renders with custom props', () => {
      render(
        <RealTimeTracingDashboard
          swarmId="custom-swarm"
          refreshInterval={1000}
          maxTraces={50}
          enableAutoRefresh={false}
        />
      );
      
      expect(screen.getByText('custom-swarm')).toBeInTheDocument();
      expect(mockUseLangfuseRealtime).toHaveBeenCalledWith({
        swarmId: 'custom-swarm',
        maxTraces: 50,
        enableAutoRefresh: false,
        refreshInterval: 1000,
      });
    });

    it('displays connection status indicator', () => {
      render(<RealTimeTracingDashboard />);
      
      // Should show connected indicator (green dot)
      const connectionIndicator = document.querySelector('.bg-green-500');
      expect(connectionIndicator).toBeInTheDocument();
    });

    it('shows disconnected state when not connected', () => {
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        isConnected: false,
      });

      render(<RealTimeTracingDashboard />);
      
      // Should show disconnected indicator (red dot)
      const connectionIndicator = document.querySelector('.bg-red-500');
      expect(connectionIndicator).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('passes correct options to useLangfuseRealtime hook', () => {
      const props = {
        swarmId: 'test-swarm',
        refreshInterval: 3000,
        maxTraces: 75,
        enableAutoRefresh: true,
      };

      render(<RealTimeTracingDashboard {...props} />);
      
      expect(mockUseLangfuseRealtime).toHaveBeenCalledWith(props);
    });

    it('uses default values when props are not provided', () => {
      render(<RealTimeTracingDashboard />);
      
      expect(mockUseLangfuseRealtime).toHaveBeenCalledWith({
        swarmId: undefined,
        maxTraces: 100,
        enableAutoRefresh: true,
        refreshInterval: 2000,
      });
    });
  });

  describe('User Interactions', () => {
    it('handles pause/resume button clicks', async () => {
      render(<RealTimeTracingDashboard />);
      
      const pauseButton = screen.getByText('Pause');
      expect(pauseButton).toBeInTheDocument();
      
      await userEvent.click(pauseButton);
      
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });

    it('handles refresh button click', async () => {
      const mockRefresh = vi.fn();
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        refresh: mockRefresh,
      });

      render(<RealTimeTracingDashboard />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('handles export data functionality', async () => {
      // Mock URL.createObjectURL and other required DOM APIs
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement and appendChild/removeChild
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

      render(<RealTimeTracingDashboard />);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await userEvent.click(exportButton);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('handles time range selection', async () => {
      render(<RealTimeTracingDashboard />);
      
      // Find the time range select (assuming it's rendered)
      const selects = screen.getAllByRole('combobox');
      const timeRangeSelect = selects.find(select => 
        select.getAttribute('aria-expanded') !== null
      );
      
      if (timeRangeSelect) {
        await userEvent.click(timeRangeSelect);
        // The exact implementation would depend on the Select component
      }
    });
  });

  describe('Data Display and Filtering', () => {
    it('displays trace information correctly', () => {
      render(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('Test Trace')).toBeInTheDocument();
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
      expect(screen.getByText('$0.0030')).toBeInTheDocument();
    });

    it('handles search functionality', async () => {
      render(<RealTimeTracingDashboard />);
      
      // Switch to traces tab first
      const tracesTab = screen.getByRole('button', { name: /live traces/i });
      await userEvent.click(tracesTab);
      
      const searchInput = screen.getByPlaceholderText('Search traces...');
      await userEvent.type(searchInput, 'test');
      
      expect(searchInput).toHaveValue('test');
    });

    it('handles status filtering', async () => {
      render(<RealTimeTracingDashboard />);
      
      // Switch to traces tab first
      const tracesTab = screen.getByRole('button', { name: /live traces/i });
      await userEvent.click(tracesTab);
      
      // Check if status filter elements are present
      expect(screen.getByText('All Status')).toBeInTheDocument();
    });

    it('displays metrics correctly', () => {
      render(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('6')).toBeInTheDocument(); // Active agents
      expect(screen.getByText('140')).toBeInTheDocument(); // Completed tasks
      expect(screen.getByText('1200ms')).toBeInTheDocument(); // Avg response time
      expect(screen.getByText('3.3%')).toBeInTheDocument(); // Error rate
      expect(screen.getByText('$0.450')).toBeInTheDocument(); // Total cost
      expect(screen.getByText('8,000')).toBeInTheDocument(); // Total tokens
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs correctly', async () => {
      render(<RealTimeTracingDashboard />);
      
      // Test overview tab (default)
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
      
      // Switch to traces tab
      const tracesTab = screen.getByRole('button', { name: /live traces/i });
      await userEvent.click(tracesTab);
      
      expect(screen.getByText('Live Trace Stream')).toBeInTheDocument();
      
      // Switch to agents tab
      const agentsTab = screen.getByRole('button', { name: /agents/i });
      await userEvent.click(agentsTab);
      
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });

    it('displays agent information in agents tab', async () => {
      render(<RealTimeTracingDashboard />);
      
      const agentsTab = screen.getByRole('button', { name: /agents/i });
      await userEvent.click(agentsTab);
      
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // Tasks completed
      expect(screen.getByText('800ms')).toBeInTheDocument(); // Avg response time
    });
  });

  describe('Error States', () => {
    it('handles connection errors gracefully', () => {
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        error: 'Connection failed',
        isConnected: false,
      });

      render(<RealTimeTracingDashboard />);
      
      // Should show disconnected state
      const connectionIndicator = document.querySelector('.bg-red-500');
      expect(connectionIndicator).toBeInTheDocument();
    });

    it('handles empty data states', () => {
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        traces: [],
        agents: [],
        metrics: null,
      });

      render(<RealTimeTracingDashboard />);
      
      // Should still render without crashing
      expect(screen.getByText('Real-Time Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('displays initializing state', () => {
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        isInitializing: true,
        traces: [],
        agents: [],
        metrics: null,
      });

      render(<RealTimeTracingDashboard />);
      
      // Should show basic dashboard structure even while initializing
      expect(screen.getByText('Real-Time Swarm Tracing Dashboard')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('updates when new traces are received', async () => {
      const { rerender } = render(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('Test Trace')).toBeInTheDocument();
      
      // Simulate new trace
      const newTrace = {
        ...mockTrace,
        id: 'trace-2',
        name: 'New Trace',
      };
      
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        traces: [newTrace, mockTrace],
      });
      
      rerender(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('New Trace')).toBeInTheDocument();
    });

    it('updates metrics when they change', async () => {
      const { rerender } = render(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('140')).toBeInTheDocument(); // Completed tasks
      
      // Simulate metrics update
      const updatedMetrics = {
        ...mockMetrics,
        completedTasks: 145,
      };
      
      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        metrics: updatedMetrics,
      });
      
      rerender(<RealTimeTracingDashboard />);
      
      expect(screen.getByText('145')).toBeInTheDocument();
    });
  });

  describe('Chart Components', () => {
    it('renders chart components', () => {
      render(<RealTimeTracingDashboard />);
      
      // Should render ResponsiveContainer components for charts
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(2);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('renders performance tab charts', async () => {
      render(<RealTimeTracingDashboard />);
      
      const performanceTab = screen.getByRole('button', { name: /performance/i });
      await userEvent.click(performanceTab);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<RealTimeTracingDashboard />);
      
      // Check for button roles
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<RealTimeTracingDashboard />);
      
      const pauseButton = screen.getByRole('button', { name: /pause/i });
      
      // Focus the button and press Enter
      pauseButton.focus();
      expect(pauseButton).toHaveFocus();
      
      await userEvent.keyboard('{Enter}');
      
      // Should toggle to Resume
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large numbers of traces efficiently', () => {
      const manyTraces = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTrace,
        id: `trace-${i}`,
        name: `Trace ${i}`,
      }));

      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        traces: manyTraces,
      });

      const startTime = performance.now();
      render(<RealTimeTracingDashboard />);
      const endTime = performance.now();
      
      // Should render within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('respects maxTraces prop', () => {
      const manyTraces = Array.from({ length: 150 }, (_, i) => ({
        ...mockTrace,
        id: `trace-${i}`,
        name: `Trace ${i}`,
      }));

      mockUseLangfuseRealtime.mockReturnValue({
        ...defaultMockHookReturn,
        traces: manyTraces,
      });

      render(<RealTimeTracingDashboard maxTraces={50} />);
      
      expect(mockUseLangfuseRealtime).toHaveBeenCalledWith(
        expect.objectContaining({ maxTraces: 50 })
      );
    });
  });
});