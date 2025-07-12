-- Enable Row Level Security on all tables
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_metrics ENABLE ROW LEVEL SECURITY;

-- Swarms policies
-- Users can view all swarms (for now - can be restricted later)
CREATE POLICY "Public swarms are viewable by everyone"
  ON swarms FOR SELECT
  USING (true);

-- Users can only create swarms if authenticated
CREATE POLICY "Authenticated users can create swarms"
  ON swarms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can only update their own swarms
CREATE POLICY "Users can update their own swarms"
  ON swarms FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can only delete their own swarms
CREATE POLICY "Users can delete their own swarms"
  ON swarms FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Workers policies
-- Anyone can view workers of public swarms
CREATE POLICY "Workers are viewable by everyone"
  ON workers FOR SELECT
  USING (true);

-- Only swarm owners can create workers
CREATE POLICY "Swarm owners can create workers"
  ON workers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = workers.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Only swarm owners can update workers
CREATE POLICY "Swarm owners can update workers"
  ON workers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = workers.swarm_id
      AND swarms.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = workers.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Only swarm owners can delete workers
CREATE POLICY "Swarm owners can delete workers"
  ON workers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = workers.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Swarm logs policies
-- Anyone can view logs of public swarms
CREATE POLICY "Logs are viewable by everyone"
  ON swarm_logs FOR SELECT
  USING (true);

-- Only swarm owners can create logs
CREATE POLICY "Swarm owners can create logs"
  ON swarm_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = swarm_logs.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Tasks policies
-- Anyone can view tasks of public swarms
CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT
  USING (true);

-- Only swarm owners can create tasks
CREATE POLICY "Swarm owners can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = tasks.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Only swarm owners can update tasks
CREATE POLICY "Swarm owners can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = tasks.swarm_id
      AND swarms.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = tasks.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );

-- Swarm metrics policies
-- Anyone can view metrics of public swarms
CREATE POLICY "Metrics are viewable by everyone"
  ON swarm_metrics FOR SELECT
  USING (true);

-- Only swarm owners can create metrics
CREATE POLICY "Swarm owners can create metrics"
  ON swarm_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swarms
      WHERE swarms.id = swarm_metrics.swarm_id
      AND swarms.created_by = auth.uid()
    )
  );