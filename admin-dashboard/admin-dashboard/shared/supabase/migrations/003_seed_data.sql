-- Seed data for development
-- Only run this in development environments

-- Insert sample swarms
INSERT INTO swarms (id, name, status, topology, max_workers, config) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Development Swarm', 'active', 'mesh', 5, '{"auto_scale": true, "min_workers": 2}'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Testing Swarm', 'idle', 'hierarchical', 10, '{"test_mode": true}'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Production Swarm', 'active', 'star', 20, '{"high_availability": true}')
ON CONFLICT (id) DO NOTHING;

-- Insert sample workers
INSERT INTO workers (id, swarm_id, machine_id, name, type, status, capabilities) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'machine-dev-001', 'Dev Worker 1', 'coordinator', 'active', '["orchestration", "monitoring"]'),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'machine-dev-002', 'Dev Worker 2', 'researcher', 'active', '["data_analysis", "web_scraping"]'),
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'machine-dev-003', 'Dev Worker 3', 'coder', 'idle', '["javascript", "python", "rust"]'),
  ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'machine-prod-001', 'Prod Coordinator', 'coordinator', 'active', '["orchestration", "monitoring", "scaling"]'),
  ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'machine-prod-002', 'Prod Coder 1', 'coder', 'active', '["typescript", "react", "node"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample tasks
INSERT INTO tasks (id, swarm_id, type, status, priority, payload, assigned_to) VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'code_review', 'completed', 'high', '{"repository": "admin-dashboard", "pr_number": 123}', '660e8400-e29b-41d4-a716-446655440003'),
  ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'data_analysis', 'in_progress', 'medium', '{"dataset": "user_metrics", "timeframe": "30d"}', '660e8400-e29b-41d4-a716-446655440002'),
  ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'deployment', 'pending', 'critical', '{"service": "api", "version": "2.1.0"}', NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert sample logs
INSERT INTO swarm_logs (swarm_id, worker_id, level, message, metadata) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'info', 'Swarm initialized successfully', '{"startup_time": "2.3s"}'),
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'info', 'Starting data analysis task', '{"task_id": "770e8400-e29b-41d4-a716-446655440002"}'),
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440004', 'warn', 'High memory usage detected', '{"memory_usage": "85%", "threshold": "80%"}');

-- Insert sample metrics
INSERT INTO swarm_metrics (swarm_id, metric_type, value, metadata) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'task_completion_rate', 0.92, '{"period": "24h"}'),
  ('550e8400-e29b-41d4-a716-446655440001', 'average_response_time', 234.5, '{"unit": "ms", "period": "1h"}'),
  ('550e8400-e29b-41d4-a716-446655440003', 'cpu_utilization', 0.65, '{"worker_count": 5}'),
  ('550e8400-e29b-41d4-a716-446655440003', 'memory_utilization', 0.78, '{"worker_count": 5}');