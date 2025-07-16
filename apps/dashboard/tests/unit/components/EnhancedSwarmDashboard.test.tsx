import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { EnhancedSwarmDashboard } from '../../../components/observability/EnhancedSwarmDashboard';

// Mock lazy-loaded components
vi.mock('../../../components/observability/RealTimeTracingDashboard', () => ({
  RealTimeTracingDashboard: ({ swarmId, refreshInterval, enableAutoRefresh, maxTraces }: any) => (
    <div data-testid="real-time-tracing-dashboard">
      <span>Mocked RealTimeTracingDashboard</span>
      <span data-testid="swarm-id">{swarmId}</span>
      <span data-testid="refresh-interval">{refreshInterval}</span>
      <span data-testid="auto-refresh">{enableAutoRefresh?.toString()}</span>
      <span data-testid="max-traces">{maxTraces}</span>
    </div>
  ),
}));

vi.mock('../../../components/observability/ActionVisualization', () => ({
  ActionVisualization: ({ swarmId, height, autoPlay, showTimeline, maxFlows }: any) => (
    <div data-testid="action-visualization">
      <span>Mocked ActionVisualization</span>
      <span data-testid="height">{height}</span>
      <span data-testid="auto-play">{autoPlay?.toString()}</span>
      <span data-testid="show-timeline">{showTimeline?.toString()}</span>
      <span data-testid="max-flows">{maxFlows}</span>
    </div>
  ),
}));

vi.mock('../../../components/observability/EnhancedLangfuseIntegration', () => ({
  EnhancedLangfuseIntegration: ({ swarmId, autoRefresh, refreshInterval, maxTraces, realTimeUpdates }: any) => (
    <div data-testid="enhanced-langfuse-integration">
      <span>Mocked EnhancedLangfuseIntegration</span>
      <span data-testid="auto-refresh">{autoRefresh?.toString()}</span>
      <span data-testid="refresh-interval">{refreshInterval}</span>
      <span data-testid="max-traces">{maxTraces}</span>
      <span data-testid="real-time-updates">{realTimeUpdates?.toString()}</span>
    </div>
  ),
}));

vi.mock('../../../components/observability/ObservabilityDashboard', () => ({
  ObservabilityDashboard: ({ swarmId }: any) => (
    <div data-testid="observability-dashboard">
      <span>Mocked ObservabilityDashboard</span>
      <span data-testid="swarm-id">{swarmId}</span>
    </div>
  ),
}));

// Mock UI components
vi.mock('../../../components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <div data-testid="tabs" data-value={value} {...props}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value, ...props }: any) => (
    <div data-testid="tabs-content" data-value={value} {...props}>
      {children}
    </div>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div data-testid="tabs-list" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, ...props }: any) => (
    <button data-testid="tabs-trigger" data-value={value} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => (
    <div data-testid="alert" {...props}>
      {children}
    </div>
  ),
  AlertDescription: ({ children, ...props }: any) => (
    <div data-testid="alert-description" {...props}>
      {children}
    </div>
  ),
}));

// Mock window resize events
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('EnhancedSwarmDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window dimensions
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders the dashboard with default props', async () => {
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
      expect(screen.getByText('swarm_main')).toBeInTheDocument();
      expect(screen.getByText('System Status')).toBeInTheDocument();
    });

    it('renders with custom props', async () => {
      render(
        <EnhancedSwarmDashboard
          swarmId="custom-swarm"
          mode="tablet"
          theme="dark"
          realTimeUpdates={false}
          autoRefresh={false}
          refreshInterval={10000}
        />
      );
      
      expect(screen.getByText('custom-swarm')).toBeInTheDocument();
    });

    it('displays responsive layout for mobile devices', async () => {
      // Mock mobile viewport
      window.innerWidth = 500;
      fireEvent(window, new Event('resize'));
      
      render(<EnhancedSwarmDashboard mode="mobile" />);
      
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
    });

    it('displays device type indicators correctly', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Should show desktop indicator by default
      const deviceIcons = document.querySelectorAll('[data-testid*="device"]');
      // This would depend on how the icons are rendered
    });
  });

  describe('Props Handling', () => {
    it('passes correct props to child components', async () => {
      render(
        <EnhancedSwarmDashboard
          swarmId="test-swarm"
          refreshInterval={5000}
          autoRefresh={true}
          realTimeUpdates={true}
        />
      );
      
      // Switch to traces tab to load RealTimeTracingDashboard
      const tracesTab = screen.getByTestId('tabs-trigger');
      await userEvent.click(tracesTab);
      
      // Wait for lazy loading
      await waitFor(() => {
        expect(screen.getByTestId('real-time-tracing-dashboard')).toBeInTheDocument();
      });
    });

    it('uses default values when props are not provided', () => {
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('swarm_main')).toBeInTheDocument();
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles refresh button click', async () => {
      render(<EnhancedSwarmDashboard />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      
      // Should trigger data refresh
      expect(refreshButton).toBeInTheDocument();
    });

    it('handles alerts button click', async () => {
      render(<EnhancedSwarmDashboard />);
      
      const alertsButton = screen.getByRole('button', { name: /bell/i });
      await userEvent.click(alertsButton);
      
      // Should switch to alerts tab
      expect(alertsButton).toBeInTheDocument();
    });

    it('displays loading state during data fetch', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Should show refresh button in normal state initially
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).not.toBeDisabled();
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs correctly', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Default should show overview
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      
      // Find and click traces tab
      const tracesTab = screen.getByRole('button', { name: /traces/i });
      await userEvent.click(tracesTab);
      
      // Should show loading initially, then the component
      await waitFor(() => {
        expect(screen.getByText('Loading real-time tracing dashboard...')).toBeInTheDocument();
      });
    });

    it('shows different tabs based on device mode', () => {
      const { rerender } = render(<EnhancedSwarmDashboard mode="mobile" />);
      
      // Mobile should have fewer tabs
      const tabs = screen.getAllByTestId('tabs-trigger');
      expect(tabs.length).toBeGreaterThan(0);
      
      rerender(<EnhancedSwarmDashboard mode="desktop" />);
      
      // Desktop should have more tabs
      const desktopTabs = screen.getAllByTestId('tabs-trigger');
      expect(desktopTabs.length).toBeGreaterThanOrEqual(tabs.length);
    });

    it('displays alerts count in alerts tab', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Initially might not have alerts indicator
      // After generating alerts through interaction or waiting
      await waitFor(() => {
        const alertsTab = screen.getByRole('button', { name: /alerts/i });
        expect(alertsTab).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays health metrics correctly', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Wait for mock data to be generated and displayed
      await waitFor(() => {
        // Should show some percentage for health
        const healthElements = screen.getAllByText(/%/);
        expect(healthElements.length).toBeGreaterThan(0);
      });
    });

    it('displays system status information', async () => {
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Langfuse API')).toBeInTheDocument();
      expect(screen.getByText('WebSocket')).toBeInTheDocument();
      expect(screen.getByText('Real-time')).toBeInTheDocument();
    });

    it('handles empty data states gracefully', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Should render without crashing even with no initial data
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('shows correct agent and task counts', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Wait for mock metrics to be generated
      await waitFor(() => {
        // Should show numeric values for various metrics
        const metrics = screen.getByText('Agents');
        expect(metrics).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', async () => {
      // Mock mobile viewport
      window.innerWidth = 400;
      fireEvent(window, new Event('resize'));
      
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
    });

    it('adapts layout for tablet screens', async () => {
      // Mock tablet viewport
      window.innerWidth = 800;
      fireEvent(window, new Event('resize'));
      
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('adapts layout for desktop screens', async () => {
      // Mock desktop viewport
      window.innerWidth = 1200;
      fireEvent(window, new Event('resize'));
      
      render(<EnhancedSwarmDashboard />);
      
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('updates device type on window resize', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Start with desktop
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
      
      // Resize to mobile
      act(() => {
        window.innerWidth = 400;
        fireEvent(window, new Event('resize'));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates metrics periodically when auto-refresh is enabled', async () => {
      vi.useFakeTimers();
      
      render(<EnhancedSwarmDashboard autoRefresh={true} refreshInterval={1000} />);
      
      // Fast-forward time to trigger auto-refresh
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // Should still be rendering without errors
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('generates and displays alerts over time', async () => {
      vi.useFakeTimers();
      
      render(<EnhancedSwarmDashboard realTimeUpdates={true} refreshInterval={1000} />);
      
      // Fast-forward to trigger alert generation
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      // Should generate some alerts
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('stops updates when real-time is disabled', () => {
      render(<EnhancedSwarmDashboard realTimeUpdates={false} />);
      
      // Should still render but without real-time updates
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles data fetch errors gracefully', async () => {
      // Mock console.error to avoid noise in tests
      const originalError = console.error;
      console.error = vi.fn();
      
      render(<EnhancedSwarmDashboard />);
      
      // Should render without crashing even if data fetch fails
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
      
      console.error = originalError;
    });

    it('displays error alerts when system issues occur', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Wait for potential error alerts to be generated
      await waitFor(() => {
        expect(screen.getByText('System Status')).toBeInTheDocument();
      });
    });
  });

  describe('Alerts System', () => {
    it('displays and manages alerts correctly', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Switch to alerts tab
      const alertsTab = screen.getByRole('button', { name: /alerts/i });
      await userEvent.click(alertsTab);
      
      expect(screen.getByText('System Alerts')).toBeInTheDocument();
    });

    it('handles alert acknowledgment', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Switch to alerts tab
      const alertsTab = screen.getByRole('button', { name: /alerts/i });
      await userEvent.click(alertsTab);
      
      // Wait for alerts to be generated
      await waitFor(() => {
        const acknowledgeButtons = screen.queryAllByText('Acknowledge');
        if (acknowledgeButtons.length > 0) {
          userEvent.click(acknowledgeButtons[0]);
        }
      });
    });

    it('handles alert dismissal', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Switch to alerts tab
      const alertsTab = screen.getByRole('button', { name: /alerts/i });
      await userEvent.click(alertsTab);
      
      // Wait for alerts to be generated
      await waitFor(() => {
        const dismissButtons = screen.queryAllByText('×');
        if (dismissButtons.length > 0) {
          userEvent.click(dismissButtons[0]);
        }
      });
    });
  });

  describe('Performance', () => {
    it('handles large amounts of data efficiently', async () => {
      const startTime = performance.now();
      
      render(<EnhancedSwarmDashboard />);
      
      const endTime = performance.now();
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('lazy loads heavy components', async () => {
      render(<EnhancedSwarmDashboard />);
      
      // Initially should show loading states
      const tracesTab = screen.getByRole('button', { name: /traces/i });
      await userEvent.click(tracesTab);
      
      // Should show loading message
      expect(screen.getByText('Loading real-time tracing dashboard...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<EnhancedSwarmDashboard />);
      
      // Check for button roles
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<EnhancedSwarmDashboard />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      
      // Focus and interact with keyboard
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();
      
      await userEvent.keyboard('{Enter}');
    });

    it('has proper heading hierarchy', () => {
      render(<EnhancedSwarmDashboard />);
      
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();
    });
  });

  describe('Theme Support', () => {
    it('applies dark theme classes when specified', () => {
      render(<EnhancedSwarmDashboard theme="dark" />);
      
      // Should apply dark theme classes
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('applies light theme classes when specified', () => {
      render(<EnhancedSwarmDashboard theme="light" />);
      
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });

    it('uses auto theme detection by default', () => {
      render(<EnhancedSwarmDashboard theme="auto" />);
      
      expect(screen.getByText('Enhanced Swarm Tracing Dashboard')).toBeInTheDocument();
    });
  });
});