import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmLaunchForm } from '../../components/SwarmLaunchForm';

describe('SwarmLaunchForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields correctly', () => {
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/app name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/docker image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpu cores/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/memory/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/min instances/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max instances/i)).toBeInTheDocument();
    expect(screen.getByText(/environment variables/i)).toBeInTheDocument();
  });

  it('shows default environment variables', () => {
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    expect(screen.getByDisplayValue('NODE_ENV')).toBeInTheDocument();
    expect(screen.getByDisplayValue('production')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WORKER_TYPE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('general')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SWARM_COORDINATION')).toBeInTheDocument();
    expect(screen.getByDisplayValue('enabled')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TRUST_GRAPH_ENABLED')).toBeInTheDocument();
    expect(screen.getByDisplayValue('true')).toBeInTheDocument();
  });

  it('validates app name input', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    const submitButton = screen.getByRole('button', { name: /launch swarm/i });

    // Test invalid app name with uppercase
    await user.type(appNameInput, 'Invalid-App-Name');
    await user.click(submitButton);

    // Should not submit due to pattern validation
    expect(mockOnSubmit).not.toHaveBeenCalled();

    // Test valid app name
    await user.clear(appNameInput);
    await user.type(appNameInput, 'valid-app-name');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'valid-app-name'
        })
      );
    });
  });

  it('allows adding and removing environment variables', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const addButton = screen.getByRole('button', { name: /add variable/i });
    
    // Add new env var
    await user.click(addButton);
    
    const envInputs = screen.getAllByPlaceholderText('KEY');
    expect(envInputs).toHaveLength(5); // 4 default + 1 new

    // Fill in the new env var
    const newKeyInput = envInputs[4];
    const newValueInputs = screen.getAllByPlaceholderText('value');
    const newValueInput = newValueInputs[4];

    await user.type(newKeyInput, 'NEW_VAR');
    await user.type(newValueInput, 'new_value');

    // Remove an env var
    const removeButtons = screen.getAllByRole('button');
    const trashButtons = removeButtons.filter(btn => 
      btn.querySelector('svg')?.getAttribute('data-lucide') === 'trash-2'
    );
    
    await user.click(trashButtons[0]);

    // Should have 4 env vars now (3 default + 1 new)
    const remainingEnvInputs = screen.getAllByPlaceholderText('KEY');
    expect(remainingEnvInputs).toHaveLength(4);
  });

  it('updates resource configuration correctly', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    // Update CPU configuration
    const cpuSelect = screen.getByLabelText(/cpu cores/i);
    await user.click(cpuSelect);
    await user.click(screen.getByText('4 CPUs'));

    // Update memory configuration
    const memorySelect = screen.getByLabelText(/memory/i);
    await user.click(memorySelect);
    await user.click(screen.getByText('2 GB'));

    // Update min instances
    const minInstancesInput = screen.getByLabelText(/min instances/i);
    await user.clear(minInstancesInput);
    await user.type(minInstancesInput, '2');

    // Update max instances
    const maxInstancesInput = screen.getByLabelText(/max instances/i);
    await user.clear(maxInstancesInput);
    await user.type(maxInstancesInput, '20');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            cpus: 4,
            memory: 2048,
            minInstances: 2,
            maxInstances: 20
          })
        })
      );
    });
  });

  it('updates region selection', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    const regionSelect = screen.getByLabelText(/region/i);
    await user.click(regionSelect);
    await user.click(screen.getByText('Amsterdam, Netherlands'));

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'ams'
        })
      );
    });
  });

  it('includes observability environment variables in submission', async () => {
    const user = userEvent.setup();
    
    // Mock environment variables
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_LANGFUSE_SECRET_KEY: 'test-secret',
      NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY: 'test-public',
      NEXT_PUBLIC_LANGFUSE_HOST: 'https://test-langfuse.com',
      NEXT_PUBLIC_TRUSTGRAPH_API_KEY: 'test-trust-key',
      NEXT_PUBLIC_TRUSTGRAPH_API_URL: 'https://test-trust-api.com'
    };

    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            LANGFUSE_SECRET_KEY: 'test-secret',
            LANGFUSE_PUBLIC_KEY: 'test-public',
            LANGFUSE_HOST: 'https://test-langfuse.com',
            TRUSTGRAPH_API_KEY: 'test-trust-key',
            TRUSTGRAPH_API_URL: 'https://test-trust-api.com'
          })
        })
      );
    });

    // Restore original environment
    process.env = originalEnv;
  });

  it('shows loading state when isLoading is true', () => {
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /launching/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/launching/i)).toBeInTheDocument();
  });

  it('disables submit button when app name is empty', () => {
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    expect(submitButton).toBeDisabled();
  });

  it('uses default docker image when field is empty', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          dockerImage: 'ghcr.io/ruvnet/claude-swarm:latest'
        })
      );
    });
  });

  it('handles custom docker image input', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    const dockerImageInput = screen.getByLabelText(/docker image/i);
    await user.type(dockerImageInput, 'custom/image:v1.0.0');

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          dockerImage: 'custom/image:v1.0.0'
        })
      );
    });
  });

  it('prevents removal of last environment variable', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    // Remove env vars until only one remains
    const removeButtons = () => screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg')?.getAttribute('data-lucide') === 'trash-2'
    );

    // Remove 3 env vars, leaving 1
    await user.click(removeButtons()[0]);
    await user.click(removeButtons()[0]);
    await user.click(removeButtons()[0]);

    // The last remove button should be disabled
    const lastRemoveButton = removeButtons()[0];
    expect(lastRemoveButton).toBeDisabled();
  });

  it('includes health check configuration in submission', async () => {
    const user = userEvent.setup();
    render(<SwarmLaunchForm onSubmit={mockOnSubmit} />);

    const appNameInput = screen.getByLabelText(/app name/i);
    await user.type(appNameInput, 'test-app');

    const submitButton = screen.getByRole('button', { name: /launch swarm/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            autoScale: true,
            healthCheckPath: '/health',
            healthCheckTimeout: 10
          })
        })
      );
    });
  });
});