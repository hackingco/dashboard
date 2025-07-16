import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmList } from '../../components/SwarmList';

// Mock the supabase client
vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    from: vi.fn(),
  },
  swarmOperations: {
    list: vi.fn(),
    subscribe: vi.fn(() => ({
      unsubscribe: vi.fn(),
    })),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => '2023-12-01 10:00:00'),
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

const mockSwarms = [
  {
    id: 'swarm-1',
    name: 'Production Swarm',
    purpose: 'Main production workload',
    status: 'running',
    worker_count: 3,
    config: { maxWorkers: 5 },
    metrics: { 
      tasks_completed: 150, 
      average_task_duration: 250 
    },
    created_at: '2023-12-01T08:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    error: null,
  },
  {
    id: 'swarm-2',
    name: 'Development Swarm',
    purpose: 'Development and testing',
    status: 'stopped',
    worker_count: 0,
    config: { maxWorkers: 3 },
    metrics: { 
      tasks_completed: 45, 
      average_task_duration: 180 
    },
    created_at: '2023-12-01T09:00:00Z',
    updated_at: '2023-12-01T09:30:00Z',
    error: null,
  },
  {
    id: 'swarm-3',
    name: 'Error Swarm',
    purpose: 'Swarm with error state',
    status: 'error',
    worker_count: 1,
    config: { maxWorkers: 2 },
    metrics: { 
      tasks_completed: 10, 
      average_task_duration: 500 
    },
    created_at: '2023-12-01T07:00:00Z',
    updated_at: '2023-12-01T07:30:00Z',
    error: 'Connection timeout to worker nodes',
  },
];

describe('SwarmList', () => {
  const { swarmOperations } = await import('../../lib/supabase-client');

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('shows loading state initially', () => {
    vi.mocked(swarmOperations.list).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<SwarmList />);
    
    expect(screen.getByRole('generic')).toContainElement(
      screen.getByTestId('loading-spinner') || 
      document.querySelector('.animate-spin')
    );
  });

  it('displays swarms when data loads successfully', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Production Swarm')).toBeInTheDocument();
      expect(screen.getByText('Development Swarm')).toBeInTheDocument();
      expect(screen.getByText('Error Swarm')).toBeInTheDocument();
    });

    // Check status badges
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();

    // Check metrics
    expect(screen.getByText('150')).toBeInTheDocument(); // tasks completed
    expect(screen.getByText('250ms')).toBeInTheDocument(); // avg task duration
  });

  it('shows empty state when no swarms exist', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue([]);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('No swarms deployed')).toBeInTheDocument();
      expect(screen.getByText('Launch your first swarm to get started')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(swarmOperations.list).mockRejectedValue(new Error('API Error'));

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load swarms')).toBeInTheDocument();
    });
  });

  it('displays error messages for swarms with errors', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Connection timeout to worker nodes')).toBeInTheDocument();
    });
  });

  it('shows correct worker count and capacity', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('3 / 5')).toBeInTheDocument(); // Production swarm
      expect(screen.getByText('0 / 3')).toBeInTheDocument(); // Development swarm
    });
  });

  it('handles swarm scaling operations', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Production Swarm')).toBeInTheDocument();
    });

    // Find and click Scale Up button for running swarm
    const scaleUpButton = screen.getByRole('button', { name: /scale up/i });
    fireEvent.click(scaleUpButton);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/swarms/swarm-1/scale',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerCount: 4 }),
      })
    );
  });

  it('handles swarm start operation for stopped swarms', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Development Swarm')).toBeInTheDocument();
    });

    // Find and click Start button for stopped swarm
    const startButton = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startButton);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/swarms/swarm-2/start',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerCount: 1 }),
      })
    );
  });

  it('handles swarm stop operation for running swarms', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Production Swarm')).toBeInTheDocument();
    });

    // Find and click Stop button for running swarm
    const stopButton = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/swarms/swarm-1/stop',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('disables scale up when at max capacity', async () => {
    const maxCapacitySwarm = [{
      ...mockSwarms[0],
      worker_count: 5, // At max capacity
    }];
    
    vi.mocked(swarmOperations.list).mockResolvedValue(maxCapacitySwarm);

    render(<SwarmList />);

    await waitFor(() => {
      const scaleUpButton = screen.getByRole('button', { name: /scale up/i });
      expect(scaleUpButton).toBeDisabled();
    });
  });

  it('disables scale down when at minimum capacity', async () => {
    const minCapacitySwarm = [{
      ...mockSwarms[0],
      worker_count: 1, // At min capacity
    }];
    
    vi.mocked(swarmOperations.list).mockResolvedValue(minCapacitySwarm);

    render(<SwarmList />);

    await waitFor(() => {
      const scaleDownButton = screen.getByRole('button', { name: /scale down/i });
      expect(scaleDownButton).toBeDisabled();
    });
  });

  it('sets up real-time subscription on mount', async () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(swarmOperations.subscribe).mockReturnValue({
      unsubscribe: mockUnsubscribe,
    });
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    const { unmount } = render(<SwarmList />);

    expect(swarmOperations.subscribe).toHaveBeenCalledWith(expect.any(Function));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('handles API errors in swarm operations gracefully', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    } as Response);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Production Swarm')).toBeInTheDocument();
    });

    const scaleUpButton = screen.getByRole('button', { name: /scale up/i });
    fireEvent.click(scaleUpButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error scaling swarm:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('displays correct status badges with proper styling', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      const runningBadge = screen.getByText('Running');
      expect(runningBadge).toHaveClass('bg-green-500');

      const stoppedBadge = screen.getByText('Stopped');
      expect(stoppedBadge).toHaveClass('bg-gray-500');

      const errorBadge = screen.getByText('Error');
      expect(errorBadge).toHaveClass('bg-red-500');
    });
  });

  it('shows swarm purposes and descriptions', async () => {
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      expect(screen.getByText('Main production workload')).toBeInTheDocument();
      expect(screen.getByText('Development and testing')).toBeInTheDocument();
      expect(screen.getByText('Swarm with error state')).toBeInTheDocument();
    });
  });

  it('refreshes data when subscription receives updates', async () => {
    let subscriptionCallback: (payload: any) => void;
    
    vi.mocked(swarmOperations.subscribe).mockImplementation((callback) => {
      subscriptionCallback = callback;
      return { unsubscribe: vi.fn() };
    });
    
    vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

    render(<SwarmList />);

    await waitFor(() => {
      expect(swarmOperations.list).toHaveBeenCalledTimes(1);
    });

    // Simulate subscription update
    subscriptionCallback({ eventType: 'UPDATE', new: mockSwarms[0] });

    await waitFor(() => {
      expect(swarmOperations.list).toHaveBeenCalledTimes(2);
    });
  });
});