import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Basic test to verify test setup is working
describe('Basic Test Setup', () => {
  it('should render a simple component', () => {
    const TestComponent = () => <div data-testid="test">Hello World</div>;
    
    render(<TestComponent />);
    
    expect(screen.getByTestId('test')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should handle basic interactions', () => {
    const TestComponent = () => (
      <button data-testid="button">Click me</button>
    );
    
    render(<TestComponent />);
    
    const button = screen.getByTestId('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
  });
});