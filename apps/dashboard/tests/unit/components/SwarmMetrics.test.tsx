import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SwarmMetrics from '../../../components/SwarmMetrics';

// Mock the machine API
vi.mock('../../../lib/machines-api', () => ({
  fetchSwarmMetrics: vi.fn(),
  fetchMachineStatus: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockMetricsData = {
  totalMachines: 5,
  activeMachines: 4,
  totalCPU: 2.5,
  totalMemory: 4096,
  averageLoad: 0.65,
  networkTraffic: {
    inbound: 125.5,
    outbound: 89.2,
  },
  errors: [],
  uptime: 99.8,
  lastUpdated: new Date().toISOString(),
};

describe('SwarmMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<SwarmMetrics />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays metrics when data loads successfully', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue(mockMetricsData);

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Total machines
      expect(screen.getByText('4')).toBeInTheDocument(); // Active machines
      expect(screen.getByText('99.8%')).toBeInTheDocument(); // Uptime
    });
  });

  it('handles API errors gracefully', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockRejectedValue(new Error('API Error'));

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/error loading metrics/i)).toBeInTheDocument();
    });
  });

  it('updates metrics every 30 seconds', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue(mockMetricsData);

    vi.useFakeTimers();
    render(<SwarmMetrics />);

    // Fast-forward 30 seconds
    vi.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(fetchSwarmMetrics).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('displays CPU usage correctly', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue({
      ...mockMetricsData,
      totalCPU: 1.5,
    });

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText('1.5')).toBeInTheDocument();
    });
  });

  it('displays memory usage in correct format', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue({
      ...mockMetricsData,
      totalMemory: 2048,
    });

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText('2.0 GB')).toBeInTheDocument();
    });
  });

  it('shows network traffic statistics', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue(mockMetricsData);

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText('125.5 MB/s')).toBeInTheDocument();
      expect(screen.getByText('89.2 MB/s')).toBeInTheDocument();
    });
  });

  it('displays error messages when present', async () => {
    const { fetchSwarmMetrics } = await import('../../../lib/machines-api');
    vi.mocked(fetchSwarmMetrics).mockResolvedValue({
      ...mockMetricsData,
      errors: ['Machine vm-001 is unresponsive', 'High memory usage on vm-003'],
    });

    render(<SwarmMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/machine vm-001 is unresponsive/i)).toBeInTheDocument();
      expect(screen.getByText(/high memory usage on vm-003/i)).toBeInTheDocument();
    });
  });
});