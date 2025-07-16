/**
 * Performance Monitoring Data Schemas
 * 
 * TypeScript interfaces and types for the comprehensive performance
 * monitoring system for Langfuse API Key Management.
 */

// Base metric interface
export interface BaseMetric {
  timestamp: number;
  metric_id: string;
  collected_at: string; // ISO 8601 format
  collector_version: string;
}

// Performance metric with labels
export interface PerformanceMetric extends BaseMetric {
  metric_name: string;
  value: number;
  labels: Record<string, string>;
  unit: MetricUnit;
  aggregation_type?: AggregationType;
}

// Metric units
export type MetricUnit = 
  | 'milliseconds'
  | 'seconds'
  | 'count'
  | 'percent'
  | 'bytes'
  | 'kilobytes'
  | 'megabytes'
  | 'traces_per_second'
  | 'requests_per_second';

// Aggregation types
export type AggregationType = 
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'rate';

// Key validation specific metrics
export interface KeyValidationMetrics extends BaseMetric {
  validation_id: string;
  duration_ms: number;
  success: boolean;
  error_type?: KeyValidationErrorType;
  error_message?: string;
  test_suite: TestSuite;
  key_type: 'public' | 'secret' | 'both';
  validation_steps: ValidationStep[];
  retry_count: number;
  
  // Detailed breakdown
  connection_time_ms: number;
  auth_time_ms: number;
  validation_time_ms: number;
  total_time_ms: number;
}

// Validation error types
export type KeyValidationErrorType =
  | 'invalid_format'
  | 'authentication_failed'
  | 'permission_denied'
  | 'rate_limited'
  | 'connection_timeout'
  | 'server_error'
  | 'network_error'
  | 'unknown';

// Test suite types
export type TestSuite = 
  | 'basic'
  | 'stress'
  | 'integration'
  | 'regression'
  | 'endurance';

// Individual validation steps
export interface ValidationStep {
  step_name: string;
  duration_ms: number;
  success: boolean;
  error?: string;
}

// Stress test metrics
export interface StressTestMetrics extends BaseMetric {
  test_id: string;
  test_phase: 'warmup' | 'running' | 'cooldown' | 'completed';
  duration_seconds: number;
  
  // Concurrency metrics
  concurrent_traces: number;
  max_concurrent_traces: number;
  target_concurrent_traces: number;
  
  // Throughput metrics
  total_traces: number;
  successful_traces: number;
  failed_traces: number;
  throughput_tps: number;
  target_throughput_tps: number;
  
  // Latency metrics (all in ms)
  latency_min: number;
  latency_max: number;
  latency_mean: number;
  latency_p50: number;
  latency_p75: number;
  latency_p90: number;
  latency_p95: number;
  latency_p99: number;
  latency_p999: number;
  
  // Resource metrics
  memory_usage_mb: number;
  memory_limit_mb: number;
  cpu_usage_percent: number;
  cpu_cores_used: number;
  gc_pause_total_ms: number;
  gc_pause_max_ms: number;
  
  // Network metrics
  network_bytes_sent: number;
  network_bytes_received: number;
  network_errors: number;
  
  // Error breakdown
  error_breakdown: Record<string, number>;
}

// API performance metrics
export interface APIPerformanceMetrics extends BaseMetric {
  request_id: string;
  trace_id?: string;
  span_id?: string;
  
  // Request details
  method: HTTPMethod;
  endpoint: string;
  path_params?: Record<string, string>;
  query_params?: Record<string, string>;
  
  // Response details
  status_code: number;
  status_category: StatusCategory;
  
  // Timing breakdown (all in ms)
  dns_lookup_ms?: number;
  tcp_connect_ms?: number;
  tls_handshake_ms?: number;
  request_send_ms: number;
  waiting_ms: number;
  response_receive_ms: number;
  total_duration_ms: number;
  
  // Size metrics
  request_size_bytes: number;
  response_size_bytes: number;
  request_headers_size_bytes: number;
  response_headers_size_bytes: number;
  
  // Error details
  error?: APIError;
  
  // Client info
  client_ip?: string;
  user_agent?: string;
  api_version?: string;
}

// HTTP methods
export type HTTPMethod = 
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

// Status categories
export type StatusCategory = 
  | 'success' // 2xx
  | 'redirect' // 3xx
  | 'client_error' // 4xx
  | 'server_error' // 5xx
  | 'unknown';

// API error details
export interface APIError {
  code: string;
  message: string;
  type: string;
  stack_trace?: string;
  context?: Record<string, any>;
}

// Integration test metrics
export interface IntegrationTestMetrics extends BaseMetric {
  test_id: string;
  integration_type: IntegrationType;
  test_name: string;
  
  // Test results
  passed: boolean;
  total_assertions: number;
  passed_assertions: number;
  failed_assertions: number;
  
  // Performance
  setup_time_ms: number;
  execution_time_ms: number;
  teardown_time_ms: number;
  total_time_ms: number;
  
  // Component-specific results
  component_results: ComponentTestResult[];
  
  // Dependencies
  dependencies_tested: string[];
  external_services_used: string[];
}

// Integration types
export type IntegrationType = 
  | 'swarm_integration'
  | 'mcp_integration'
  | 'agent_coordination'
  | 'real_time_streaming'
  | 'database_integration'
  | 'webhook_integration';

// Component test results
export interface ComponentTestResult {
  component_name: string;
  passed: boolean;
  duration_ms: number;
  assertions_passed: number;
  assertions_failed: number;
  error?: string;
}

// Performance regression metrics
export interface RegressionTestMetrics extends BaseMetric {
  test_id: string;
  baseline_id: string;
  
  // Performance comparison
  current_performance: PerformanceSnapshot;
  baseline_performance: PerformanceSnapshot;
  
  // Regression detection
  regression_detected: boolean;
  performance_change_percent: number;
  
  // Detailed comparison
  metric_comparisons: MetricComparison[];
  
  // Statistical analysis
  confidence_level: number;
  p_value: number;
  sample_size: number;
}

// Performance snapshot
export interface PerformanceSnapshot {
  timestamp: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  throughput_tps: number;
  error_rate_percent: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
}

// Metric comparison
export interface MetricComparison {
  metric_name: string;
  baseline_value: number;
  current_value: number;
  change_percent: number;
  regression: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Alert event
export interface AlertEvent extends BaseMetric {
  alert_id: string;
  alert_name: string;
  alert_group: string;
  
  // Alert details
  severity: AlertSeverity;
  state: AlertState;
  
  // Trigger information
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  comparison_operator: ComparisonOperator;
  
  // Duration
  triggered_at: number;
  resolved_at?: number;
  duration_seconds?: number;
  
  // Context
  labels: Record<string, string>;
  annotations: Record<string, string>;
  
  // Actions taken
  notifications_sent: NotificationRecord[];
  auto_remediation_attempted: boolean;
  auto_remediation_result?: RemediationResult;
}

// Alert severity levels
export type AlertSeverity = 
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

// Alert states
export type AlertState = 
  | 'pending'
  | 'firing'
  | 'resolved'
  | 'silenced';

// Comparison operators
export type ComparisonOperator = 
  | 'greater_than'
  | 'less_than'
  | 'equal_to'
  | 'not_equal_to'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

// Notification record
export interface NotificationRecord {
  channel: NotificationChannel;
  sent_at: number;
  success: boolean;
  error?: string;
}

// Notification channels
export type NotificationChannel = 
  | 'email'
  | 'slack'
  | 'pagerduty'
  | 'webhook'
  | 'sms';

// Remediation result
export interface RemediationResult {
  action_taken: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

// System health metrics
export interface SystemHealthMetrics extends BaseMetric {
  // Service health
  service_name: string;
  health_status: HealthStatus;
  uptime_seconds: number;
  
  // Resource utilization
  cpu_usage_percent: number;
  memory_usage_mb: number;
  memory_available_mb: number;
  disk_usage_percent: number;
  disk_io_read_mbps: number;
  disk_io_write_mbps: number;
  
  // Network health
  network_latency_ms: number;
  network_packet_loss_percent: number;
  active_connections: number;
  
  // Database health
  db_connection_pool_size: number;
  db_active_connections: number;
  db_query_latency_ms: number;
  db_replication_lag_seconds?: number;
  
  // Queue health
  queue_depth: number;
  queue_processing_rate: number;
  queue_error_rate: number;
}

// Health status
export type HealthStatus = 
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

// Aggregated performance report
export interface PerformanceReport {
  report_id: string;
  generated_at: number;
  period_start: number;
  period_end: number;
  
  // Summary statistics
  total_validations: number;
  successful_validations: number;
  failed_validations: number;
  success_rate_percent: number;
  
  // Performance metrics
  average_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  
  // Throughput
  average_throughput_tps: number;
  peak_throughput_tps: number;
  
  // Availability
  uptime_percent: number;
  downtime_minutes: number;
  incidents_count: number;
  
  // Top errors
  top_errors: ErrorSummary[];
  
  // Performance trends
  performance_trend: TrendDirection;
  latency_trend: TrendDirection;
  error_rate_trend: TrendDirection;
}

// Error summary
export interface ErrorSummary {
  error_type: string;
  count: number;
  percentage: number;
  first_seen: number;
  last_seen: number;
  example_trace_ids: string[];
}

// Trend direction
export type TrendDirection = 
  | 'improving'
  | 'stable'
  | 'degrading'
  | 'unknown';

// Export all types for use in monitoring implementation
export * from './monitoring-schemas';