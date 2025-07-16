-- Supabase Database Schema for Swarm Intelligence Dashboard
-- Run this in your Supabase SQL editor to create the required tables

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create swarm_sessions table
create table if not exists public.swarm_sessions (
  id uuid default uuid_generate_v4() primary key,
  session_name text not null,
  description text,
  total_traces integer default 0,
  active_traces integer default 0,
  total_agents integer default 0,
  active_agents integer default 0,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  status text check (status in ('active', 'completed', 'error')) default 'active',
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create swarm_traces table
create table if not exists public.swarm_traces (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.swarm_sessions(id) on delete cascade,
  trace_name text not null,
  trace_data jsonb not null default '{}',
  status text check (status in ('success', 'error', 'pending', 'running')) default 'pending',
  duration_ms integer default 0,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create swarm_agents table
create table if not exists public.swarm_agents (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null,
  status text check (status in ('active', 'idle', 'error', 'offline')) default 'idle',
  current_task text,
  tasks_completed integer default 0,
  average_response_time real default 0,
  memory_usage real default 0,
  cpu_usage real default 0,
  last_activity timestamp with time zone default now(),
  swarm_id text not null,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create swarm_metrics table
create table if not exists public.swarm_metrics (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.swarm_sessions(id) on delete cascade,
  metric_type text not null,
  metric_value real not null,
  metric_data jsonb default '{}',
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Create indexes for better performance
create index if not exists idx_swarm_traces_session_id on public.swarm_traces(session_id);
create index if not exists idx_swarm_traces_created_at on public.swarm_traces(created_at desc);
create index if not exists idx_swarm_traces_status on public.swarm_traces(status);

create index if not exists idx_swarm_agents_swarm_id on public.swarm_agents(swarm_id);
create index if not exists idx_swarm_agents_status on public.swarm_agents(status);
create index if not exists idx_swarm_agents_last_activity on public.swarm_agents(last_activity desc);

create index if not exists idx_swarm_metrics_session_id on public.swarm_metrics(session_id);
create index if not exists idx_swarm_metrics_timestamp on public.swarm_metrics(timestamp desc);
create index if not exists idx_swarm_metrics_type on public.swarm_metrics(metric_type);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_updated_at_swarm_sessions
  before update on public.swarm_sessions
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_swarm_traces
  before update on public.swarm_traces
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_swarm_agents
  before update on public.swarm_agents
  for each row execute procedure public.handle_updated_at();

-- Enable Row Level Security (RLS)
alter table public.swarm_sessions enable row level security;
alter table public.swarm_traces enable row level security;
alter table public.swarm_agents enable row level security;
alter table public.swarm_metrics enable row level security;

-- Create policies for public access (adjust as needed for your security requirements)
create policy "Allow all access to swarm_sessions" on public.swarm_sessions
  for all using (true);

create policy "Allow all access to swarm_traces" on public.swarm_traces
  for all using (true);

create policy "Allow all access to swarm_agents" on public.swarm_agents
  for all using (true);

create policy "Allow all access to swarm_metrics" on public.swarm_metrics
  for all using (true);

-- Insert sample data for testing
insert into public.swarm_sessions (id, session_name, description, start_time, status) values
  ('550e8400-e29b-41d4-a716-446655440000', 'Demo Swarm Session', 'Initial demo session for dashboard testing', now() - interval '1 hour', 'active'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Production Swarm', 'Live production swarm intelligence', now() - interval '30 minutes', 'active');

-- Insert sample agents
insert into public.swarm_agents (id, name, type, status, swarm_id, tasks_completed, average_response_time) values
  ('660e8400-e29b-41d4-a716-446655440000', 'Coordinator Agent', 'coordinator', 'active', 'swarm_observability', 15, 1200),
  ('660e8400-e29b-41d4-a716-446655440001', 'Researcher Agent', 'researcher', 'active', 'swarm_observability', 8, 2300),
  ('660e8400-e29b-41d4-a716-446655440002', 'Coder Agent', 'coder', 'active', 'swarm_observability', 12, 1800),
  ('660e8400-e29b-41d4-a716-446655440003', 'Analyst Agent', 'analyst', 'idle', 'swarm_observability', 6, 1500),
  ('660e8400-e29b-41d4-a716-446655440004', 'Tester Agent', 'tester', 'active', 'swarm_observability', 9, 1100);

-- Insert sample traces
insert into public.swarm_traces (session_id, trace_name, trace_data, status, duration_ms) values
  ('550e8400-e29b-41d4-a716-446655440000', 'Swarm Initialization', '{"action": "init", "agents": 5}', 'success', 1200),
  ('550e8400-e29b-41d4-a716-446655440000', 'Task Distribution', '{"action": "distribute", "tasks": 10}', 'success', 800),
  ('550e8400-e29b-41d4-a716-446655440000', 'Agent Coordination', '{"action": "coordinate", "agents": ["coord", "research"]}', 'success', 1500),
  ('550e8400-e29b-41d4-a716-446655440001', 'Real-time Processing', '{"action": "process", "data_points": 150}', 'running', 0),
  ('550e8400-e29b-41d4-a716-446655440001', 'Intelligence Analysis', '{"action": "analyze", "confidence": 0.95}', 'success', 2100);

-- Insert sample metrics
insert into public.swarm_metrics (session_id, metric_type, metric_value, metric_data, timestamp) values
  ('550e8400-e29b-41d4-a716-446655440000', 'cpu_usage', 65.5, '{"host": "agent-1"}', now() - interval '5 minutes'),
  ('550e8400-e29b-41d4-a716-446655440000', 'memory_usage', 78.2, '{"host": "agent-1"}', now() - interval '5 minutes'),
  ('550e8400-e29b-41d4-a716-446655440000', 'task_throughput', 15.0, '{"tasks_per_minute": 15}', now() - interval '3 minutes'),
  ('550e8400-e29b-41d4-a716-446655440001', 'response_time', 1250.0, '{"avg_ms": 1250}', now() - interval '2 minutes'),
  ('550e8400-e29b-41d4-a716-446655440001', 'error_rate', 2.1, '{"percentage": 2.1}', now() - interval '1 minute');

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- Comments for documentation
comment on table public.swarm_sessions is 'Tracks swarm intelligence sessions and overall metrics';
comment on table public.swarm_traces is 'Individual trace records from swarm operations';
comment on table public.swarm_agents is 'Agent status and performance tracking';
comment on table public.swarm_metrics is 'Time-series metrics data for dashboard analytics';