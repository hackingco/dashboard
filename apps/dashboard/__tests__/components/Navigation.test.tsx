import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Navigation } from '../../components/Navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
}));

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all navigation links', () => {
    render(<Navigation />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /swarms/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /machines/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /observability/i })).toBeInTheDocument();
  });

  it('highlights active navigation item based on current path', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/machines');

    render(<Navigation />);

    const machinesLink = screen.getByRole('link', { name: /machines/i });
    expect(machinesLink).toHaveAttribute('aria-current', 'page');
  });

  it('includes accessibility attributes', () => {
    render(<Navigation />);

    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
    });
  });

  it('has correct href attributes for all links', () => {
    render(<Navigation />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /machines/i })).toHaveAttribute('href', '/machines');
    expect(screen.getByRole('link', { name: /observability/i })).toHaveAttribute('href', '/observability');
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const firstLink = screen.getByRole('link', { name: /dashboard/i });
    const secondLink = screen.getByRole('link', { name: /machines/i });

    await user.tab();
    expect(firstLink).toHaveFocus();

    await user.tab();
    expect(secondLink).toHaveFocus();
  });

  it('renders with responsive design classes', () => {
    render(<Navigation />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('navigation'); // Assuming there's a navigation class
  });

  it('maintains focus management for screen readers', () => {
    render(<Navigation />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('tabIndex');
    });
  });
});