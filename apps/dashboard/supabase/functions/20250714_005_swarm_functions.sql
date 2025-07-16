-- =====================================================================================
-- Advanced Swarm Database Functions
-- Version: 20250714_005
-- Author: Schema Developer Agent
-- Description: Comprehensive database functions for swarm coordination and analytics
-- =====================================================================================

-- =====================================================================================
-- NETWORK MANAGEMENT FUNCTIONS
-- =====================================================================================

-- Function to get comprehensive network statistics
CREATE OR REPLACE FUNCTION public.get_network_stats(network_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    network_record RECORD;
    agent_stats JSON;
    task_stats JSON;
    performance_stats JSON;
    health_stats JSON;
BEGIN
    -- Get network basic info
    SELECT * INTO network_record
    FROM public.swarm_networks
    WHERE id = network_uuid;

    IF NOT FOUND THEN
        RETURN '{"error": "Network not found"}'::JSON;
    END IF;

    -- Calculate agent statistics
    SELECT JSON_BUILD_OBJECT(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'idle', COUNT(*) FILTER (WHERE status = 'idle'),
        'busy', COUNT(*) FILTER (WHERE status = 'busy'),
        'error', COUNT(*) FILTER (WHERE status = 'error'),
        'offline', COUNT(*) FILTER (WHERE status = 'offline'),
        'by_type', JSON_OBJECT_AGG(type, type_count)
    ) INTO agent_stats
    FROM (
        SELECT 
            type,
            COUNT(*) as type_count,
            status
        FROM public.swarm_agents
        WHERE network_id = network_uuid
        GROUP BY type, status
    ) agent_data;

    -- Calculate task statistics
    SELECT JSON_BUILD_OBJECT(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'running', COUNT(*) FILTER (WHERE status = 'running'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'avg_duration', COALESCE(AVG(actual_duration) FILTER (WHERE status = 'completed'), 0),
        'success_rate', CASE 
            WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) > 0 
            THEN ROUND(
                COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / 
                COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::NUMERIC, 
                3
            )
            ELSE 0 
        END
    ) INTO task_stats
    FROM public.task_orchestration
    WHERE network_id = network_uuid;

    -- Calculate performance statistics (last 24 hours)
    SELECT JSON_BUILD_OBJECT(
        'avg_response_time', COALESCE(AVG(metric_value) FILTER (WHERE metric_name = 'response_time'), 0),
        'total_memory_usage', COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'memory_usage'), 0),
        'total_cpu_usage', COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'cpu_usage'), 0),
        'throughput', COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'throughput'), 0),
        'error_rate', COALESCE(AVG(metric_value) FILTER (WHERE metric_name = 'error_rate'), 0)
    ) INTO performance_stats
    FROM public.performance_metrics
    WHERE network_id = network_uuid
    AND created_at > NOW() - INTERVAL '24 hours';

    -- Calculate health statistics (last hour)
    SELECT JSON_BUILD_OBJECT(
        'healthy', COUNT(*) FILTER (WHERE status = 'healthy'),
        'warning', COUNT(*) FILTER (WHERE status = 'warning'),
        'error', COUNT(*) FILTER (WHERE status = 'error'),
        'critical', COUNT(*) FILTER (WHERE status = 'critical'),
        'overall_score', CASE
            WHEN COUNT(*) = 0 THEN 100
            ELSE GREATEST(0, 100 - 
                (COUNT(*) FILTER (WHERE status = 'critical') * 20) -
                (COUNT(*) FILTER (WHERE status = 'error') * 10) -
                (COUNT(*) FILTER (WHERE status = 'warning') * 5)
            )
        END
    ) INTO health_stats
    FROM public.health_checks
    WHERE network_id = network_uuid
    AND created_at > NOW() - INTERVAL '1 hour';

    -- Build comprehensive result
    result := JSON_BUILD_OBJECT(
        'network', ROW_TO_JSON(network_record),
        'agent_stats', COALESCE(agent_stats, '{}'::JSON),
        'task_stats', COALESCE(task_stats, '{}'::JSON),
        'performance_stats', COALESCE(performance_stats, '{}'::JSON),
        'health_stats', COALESCE(health_stats, '{}'::JSON),
        'last_updated', NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-scale network based on load
CREATE OR REPLACE FUNCTION public.auto_scale_network(
    network_uuid UUID,
    target_load_percentage REAL DEFAULT 80.0
)
RETURNS JSON AS $$
DECLARE
    current_load REAL;
    current_agents INTEGER;
    max_agents INTEGER;
    recommended_agents INTEGER;
    scaling_action TEXT;
    result JSON;
BEGIN
    -- Get current network configuration
    SELECT current_agents, max_agents 
    INTO current_agents, max_agents
    FROM public.swarm_networks
    WHERE id = network_uuid;

    IF NOT FOUND THEN
        RETURN '{"error": "Network not found"}'::JSON;
    END IF;

    -- Calculate current load (simplified - based on busy agents)
    SELECT 
        CASE 
            WHEN current_agents = 0 THEN 0
            ELSE (COUNT(*) FILTER (WHERE status = 'busy'))::REAL / current_agents * 100
        END
    INTO current_load
    FROM public.swarm_agents
    WHERE network_id = network_uuid;

    -- Determine scaling recommendation
    IF current_load > target_load_percentage AND current_agents < max_agents THEN
        recommended_agents := LEAST(max_agents, CEIL(current_agents * 1.5));
        scaling_action := 'scale_up';
    ELSIF current_load < (target_load_percentage * 0.5) AND current_agents > 1 THEN
        recommended_agents := GREATEST(1, FLOOR(current_agents * 0.8));
        scaling_action := 'scale_down';
    ELSE
        recommended_agents := current_agents;
        scaling_action := 'no_change';
    END IF;

    result := JSON_BUILD_OBJECT(
        'network_id', network_uuid,
        'current_load', ROUND(current_load, 2),
        'current_agents', current_agents,
        'recommended_agents', recommended_agents,
        'scaling_action', scaling_action,
        'target_load', target_load_percentage,
        'max_agents', max_agents,
        'timestamp', NOW()
    );

    -- Log the scaling recommendation
    INSERT INTO public.coordination_events (
        network_id, event_type, event_category, event_data, severity
    ) VALUES (
        network_uuid,
        'auto_scale_recommendation',
        'performance',
        result,
        CASE 
            WHEN scaling_action = 'no_change' THEN 'info'
            ELSE 'warning'
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- AGENT MANAGEMENT FUNCTIONS
-- =====================================================================================

-- Function to calculate agent efficiency score
CREATE OR REPLACE FUNCTION public.calculate_agent_efficiency(agent_uuid UUID)
RETURNS REAL AS $$
DECLARE
    efficiency_score REAL := 0;
    task_success_rate REAL := 0;
    avg_response_time REAL := 0;
    uptime_percentage REAL := 0;
    coordination_score REAL := 0;
BEGIN
    -- Get basic agent metrics
    SELECT 
        CASE 
            WHEN (tasks_completed + tasks_failed) = 0 THEN 0
            ELSE tasks_completed::REAL / (tasks_completed + tasks_failed)
        END,
        average_response_time
    INTO task_success_rate, avg_response_time
    FROM public.swarm_agents
    WHERE id = agent_uuid;

    -- Calculate uptime (based on heartbeats in last 24 hours)
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE (COUNT(*) FILTER (WHERE status = 'healthy'))::REAL / COUNT(*) * 100
        END
    INTO uptime_percentage
    FROM public.health_checks
    WHERE agent_id = agent_uuid
    AND created_at > NOW() - INTERVAL '24 hours';

    -- Calculate coordination effectiveness (based on successful relationships)
    SELECT 
        COALESCE(AVG(strength) FILTER (WHERE status = 'active'), 0) * 100
    INTO coordination_score
    FROM public.agent_relationships
    WHERE source_agent_id = agent_uuid OR target_agent_id = agent_uuid;

    -- Weighted efficiency calculation
    efficiency_score := (
        task_success_rate * 0.4 +  -- 40% weight on task success
        LEAST(uptime_percentage / 100.0, 1.0) * 0.3 +  -- 30% weight on uptime
        GREATEST(0, 1.0 - (avg_response_time / 10000.0)) * 0.2 +  -- 20% weight on response time
        coordination_score / 100.0 * 0.1  -- 10% weight on coordination
    );

    -- Update agent efficiency score
    UPDATE public.swarm_agents
    SET efficiency_score = efficiency_score
    WHERE id = agent_uuid;

    RETURN efficiency_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find optimal agent for task
CREATE OR REPLACE FUNCTION public.find_optimal_agent_for_task(
    network_uuid UUID,
    required_capabilities JSONB DEFAULT '[]',
    preferred_agent_type TEXT DEFAULT NULL,
    exclude_busy BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    optimal_agent_id UUID;
    agent_record RECORD;
BEGIN
    -- Find the best available agent based on multiple criteria
    SELECT id INTO optimal_agent_id
    FROM (
        SELECT 
            a.id,
            a.efficiency_score,
            a.tasks_completed,
            a.average_response_time,
            a.coordination_weight,
            -- Capability match score
            CASE 
                WHEN required_capabilities::TEXT = '[]' THEN 1.0
                ELSE (
                    SELECT COUNT(*) 
                    FROM JSONB_ARRAY_ELEMENTS_TEXT(required_capabilities) req
                    WHERE req = ANY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(a.capabilities))
                )::REAL / JSONB_ARRAY_LENGTH(required_capabilities)
            END as capability_match,
            -- Type preference bonus
            CASE 
                WHEN preferred_agent_type IS NULL OR a.type = preferred_agent_type THEN 1.0
                ELSE 0.8
            END as type_bonus,
            -- Calculate overall score
            (
                a.efficiency_score * 0.3 +
                LEAST(a.tasks_completed::REAL / 100.0, 1.0) * 0.2 +
                GREATEST(0, 1.0 - a.average_response_time / 5000.0) * 0.2 +
                a.coordination_weight * 0.1 +
                (CASE 
                    WHEN required_capabilities::TEXT = '[]' THEN 1.0
                    ELSE (
                        SELECT COUNT(*) 
                        FROM JSONB_ARRAY_ELEMENTS_TEXT(required_capabilities) req
                        WHERE req = ANY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(a.capabilities))
                    )::REAL / JSONB_ARRAY_LENGTH(required_capabilities)
                END) * 0.2
            ) * 
            (CASE 
                WHEN preferred_agent_type IS NULL OR a.type = preferred_agent_type THEN 1.0
                ELSE 0.8
            END) as overall_score
        FROM public.swarm_agents a
        WHERE a.network_id = network_uuid
        AND (NOT exclude_busy OR a.status IN ('idle', 'active'))
        AND a.status NOT IN ('error', 'offline')
    ) ranked_agents
    ORDER BY overall_score DESC
    LIMIT 1;

    RETURN optimal_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- TASK ORCHESTRATION FUNCTIONS
-- =====================================================================================

-- Function to optimize task assignment
CREATE OR REPLACE FUNCTION public.optimize_task_assignment(
    task_uuid UUID,
    max_agents INTEGER DEFAULT 3
)
RETURNS JSON AS $$
DECLARE
    task_record RECORD;
    optimal_agents UUID[];
    assignment_strategy TEXT;
    estimated_duration INTEGER;
    result JSON;
BEGIN
    -- Get task details
    SELECT * INTO task_record
    FROM public.task_orchestration
    WHERE id = task_uuid;

    IF NOT FOUND THEN
        RETURN '{"error": "Task not found"}'::JSON;
    END IF;

    -- Determine assignment strategy based on task characteristics
    IF task_record.strategy = 'parallel' THEN
        assignment_strategy := 'parallel_execution';
        max_agents := LEAST(max_agents, task_record.max_parallel_agents);
    ELSIF task_record.strategy = 'sequential' THEN
        assignment_strategy := 'sequential_execution';
        max_agents := 1;
    ELSE
        -- Adaptive strategy - decide based on task complexity and network load
        SELECT 
            CASE 
                WHEN COUNT(*) FILTER (WHERE status = 'busy') > COUNT(*) * 0.7 THEN 'sequential_execution'
                ELSE 'parallel_execution'
            END
        INTO assignment_strategy
        FROM public.swarm_agents
        WHERE network_id = task_record.network_id;
        
        max_agents := CASE 
            WHEN assignment_strategy = 'sequential_execution' THEN 1
            ELSE LEAST(max_agents, task_record.max_parallel_agents)
        END;
    END IF;

    -- Find optimal agents for the task
    SELECT ARRAY_AGG(agent_id ORDER BY score DESC) INTO optimal_agents
    FROM (
        SELECT 
            id as agent_id,
            public.calculate_agent_efficiency(id) as score
        FROM public.swarm_agents
        WHERE network_id = task_record.network_id
        AND status IN ('idle', 'active')
        ORDER BY public.calculate_agent_efficiency(id) DESC
        LIMIT max_agents
    ) top_agents;

    -- Estimate duration based on similar completed tasks
    SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration)
    INTO estimated_duration
    FROM public.task_orchestration
    WHERE network_id = task_record.network_id
    AND status = 'completed'
    AND task_name ILIKE '%' || task_record.task_name || '%'
    AND actual_duration IS NOT NULL;

    -- Build result
    result := JSON_BUILD_OBJECT(
        'task_id', task_uuid,
        'optimal_agents', optimal_agents,
        'assignment_strategy', assignment_strategy,
        'estimated_duration', COALESCE(estimated_duration, task_record.estimated_duration),
        'max_parallel_agents', max_agents,
        'recommendation_timestamp', NOW()
    );

    -- Log the optimization recommendation
    INSERT INTO public.coordination_events (
        network_id, event_type, event_category, event_data, severity
    ) VALUES (
        task_record.network_id,
        'task_optimization',
        'task',
        result,
        'info'
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate task criticality
CREATE OR REPLACE FUNCTION public.calculate_task_criticality(task_uuid UUID)
RETURNS REAL AS $$
DECLARE
    criticality_score REAL := 0;
    task_record RECORD;
    dependency_count INTEGER;
    deadline_urgency REAL;
    priority_weight REAL;
BEGIN
    -- Get task details
    SELECT * INTO task_record
    FROM public.task_orchestration
    WHERE id = task_uuid;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Calculate priority weight
    priority_weight := CASE task_record.priority
        WHEN 'critical' THEN 1.0
        WHEN 'high' THEN 0.8
        WHEN 'medium' THEN 0.5
        WHEN 'low' THEN 0.2
        ELSE 0.5
    END;

    -- Calculate deadline urgency
    IF task_record.deadline IS NOT NULL THEN
        deadline_urgency := GREATEST(0, 
            1.0 - EXTRACT(EPOCH FROM (task_record.deadline - NOW())) / 
            EXTRACT(EPOCH FROM (task_record.deadline - task_record.created_at))
        );
    ELSE
        deadline_urgency := 0.3; -- Default urgency for tasks without deadline
    END IF;

    -- Count dependent tasks
    SELECT COUNT(*) INTO dependency_count
    FROM public.task_orchestration
    WHERE task_uuid = ANY(dependencies);

    -- Calculate overall criticality
    criticality_score := (
        priority_weight * 0.4 +
        deadline_urgency * 0.4 +
        LEAST(dependency_count::REAL / 10.0, 1.0) * 0.2
    );

    RETURN LEAST(1.0, criticality_score);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- MEMORY MANAGEMENT FUNCTIONS
-- =====================================================================================

-- Function to clean up expired memory entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_memory()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Delete expired memory entries
    DELETE FROM public.swarm_memory 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    -- Log cleanup operation
    IF cleaned_count > 0 THEN
        INSERT INTO public.coordination_events (
            network_id, event_type, event_category, event_data, severity
        )
        SELECT 
            network_id,
            'memory_cleanup',
            'performance',
            JSON_BUILD_OBJECT(
                'cleaned_entries', cleaned_count,
                'cleanup_timestamp', NOW()
            ),
            'info'
        FROM public.swarm_networks
        LIMIT 1; -- Just log once globally
    END IF;

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to optimize memory usage by priority
CREATE OR REPLACE FUNCTION public.optimize_memory_usage(
    network_uuid UUID,
    max_memory_entries INTEGER DEFAULT 10000
)
RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    entries_to_remove INTEGER;
    removed_count INTEGER;
    result JSON;
BEGIN
    -- Count current memory entries for the network
    SELECT COUNT(*) INTO current_count
    FROM public.swarm_memory
    WHERE network_id = network_uuid;

    IF current_count <= max_memory_entries THEN
        RETURN JSON_BUILD_OBJECT(
            'network_id', network_uuid,
            'current_entries', current_count,
            'max_entries', max_memory_entries,
            'action', 'no_optimization_needed',
            'timestamp', NOW()
        );
    END IF;

    entries_to_remove := current_count - max_memory_entries;

    -- Remove lowest priority, least accessed entries
    WITH entries_to_delete AS (
        SELECT id
        FROM public.swarm_memory
        WHERE network_id = network_uuid
        ORDER BY 
            priority ASC,
            access_count ASC,
            created_at ASC
        LIMIT entries_to_remove
    )
    DELETE FROM public.swarm_memory
    WHERE id IN (SELECT id FROM entries_to_delete);

    GET DIAGNOSTICS removed_count = ROW_COUNT;

    result := JSON_BUILD_OBJECT(
        'network_id', network_uuid,
        'initial_count', current_count,
        'max_entries', max_memory_entries,
        'removed_count', removed_count,
        'final_count', current_count - removed_count,
        'action', 'memory_optimized',
        'timestamp', NOW()
    );

    -- Log optimization
    INSERT INTO public.coordination_events (
        network_id, event_type, event_category, event_data, severity
    ) VALUES (
        network_uuid,
        'memory_optimization',
        'performance',
        result,
        'info'
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- =====================================================================================

-- Function to generate network performance report
CREATE OR REPLACE FUNCTION public.generate_performance_report(
    network_uuid UUID,
    report_period INTERVAL DEFAULT '24 hours'
)
RETURNS JSON AS $$
DECLARE
    report JSON;
    start_time TIMESTAMPTZ;
    network_info RECORD;
    agent_performance JSON;
    task_performance JSON;
    system_health JSON;
    coordination_quality JSON;
BEGIN
    start_time := NOW() - report_period;

    -- Get network basic info
    SELECT * INTO network_info
    FROM public.swarm_networks
    WHERE id = network_uuid;

    IF NOT FOUND THEN
        RETURN '{"error": "Network not found"}'::JSON;
    END IF;

    -- Agent performance metrics
    SELECT JSON_BUILD_OBJECT(
        'total_agents', COUNT(*),
        'avg_efficiency', ROUND(AVG(efficiency_score), 3),
        'avg_response_time', ROUND(AVG(average_response_time), 2),
        'total_tasks_completed', SUM(tasks_completed),
        'total_tasks_failed', SUM(tasks_failed),
        'avg_uptime', ROUND(AVG(
            EXTRACT(EPOCH FROM (COALESCE(last_heartbeat, NOW()) - created_at)) / 
            EXTRACT(EPOCH FROM (NOW() - created_at)) * 100
        ), 2),
        'by_type', JSON_OBJECT_AGG(
            type, 
            JSON_BUILD_OBJECT(
                'count', COUNT(*),
                'avg_efficiency', ROUND(AVG(efficiency_score), 3),
                'tasks_completed', SUM(tasks_completed)
            )
        )
    ) INTO agent_performance
    FROM public.swarm_agents
    WHERE network_id = network_uuid
    GROUP BY type;

    -- Task performance metrics
    SELECT JSON_BUILD_OBJECT(
        'total_tasks', COUNT(*),
        'completed_tasks', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed_tasks', COUNT(*) FILTER (WHERE status = 'failed'),
        'success_rate', ROUND(
            COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 2
        ),
        'avg_duration', ROUND(AVG(actual_duration) FILTER (WHERE actual_duration IS NOT NULL), 2),
        'avg_progress', ROUND(AVG(progress_percentage), 2),
        'by_priority', JSON_OBJECT_AGG(
            priority,
            JSON_BUILD_OBJECT(
                'count', COUNT(*),
                'success_rate', ROUND(
                    COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / 
                    NULLIF(COUNT(*), 0) * 100, 2
                )
            )
        )
    ) INTO task_performance
    FROM public.task_orchestration
    WHERE network_id = network_uuid
    AND created_at >= start_time
    GROUP BY priority;

    -- System health metrics
    SELECT JSON_BUILD_OBJECT(
        'total_health_checks', COUNT(*),
        'healthy_checks', COUNT(*) FILTER (WHERE status = 'healthy'),
        'warning_checks', COUNT(*) FILTER (WHERE status = 'warning'),
        'error_checks', COUNT(*) FILTER (WHERE status = 'error'),
        'critical_checks', COUNT(*) FILTER (WHERE status = 'critical'),
        'overall_health_score', CASE
            WHEN COUNT(*) = 0 THEN 100
            ELSE GREATEST(0, 100 - 
                (COUNT(*) FILTER (WHERE status = 'critical') * 20) -
                (COUNT(*) FILTER (WHERE status = 'error') * 10) -
                (COUNT(*) FILTER (WHERE status = 'warning') * 5)
            )
        END,
        'avg_response_time', ROUND(AVG(response_time_ms), 2)
    ) INTO system_health
    FROM public.health_checks
    WHERE network_id = network_uuid
    AND created_at >= start_time;

    -- Coordination quality metrics
    SELECT JSON_BUILD_OBJECT(
        'total_relationships', COUNT(*),
        'active_relationships', COUNT(*) FILTER (WHERE status = 'active'),
        'avg_relationship_strength', ROUND(AVG(strength), 3),
        'coordination_events', (
            SELECT COUNT(*)
            FROM public.coordination_events
            WHERE network_id = network_uuid
            AND created_at >= start_time
        ),
        'communication_frequency', (
            SELECT COUNT(*)
            FROM public.coordination_events
            WHERE network_id = network_uuid
            AND event_category = 'communication'
            AND created_at >= start_time
        )
    ) INTO coordination_quality
    FROM public.agent_relationships ar
    JOIN public.swarm_agents sa1 ON ar.source_agent_id = sa1.id
    WHERE sa1.network_id = network_uuid;

    -- Compile full report
    report := JSON_BUILD_OBJECT(
        'network_id', network_uuid,
        'network_name', network_info.name,
        'report_period', report_period,
        'report_timestamp', NOW(),
        'start_time', start_time,
        'agent_performance', COALESCE(agent_performance, '{}'::JSON),
        'task_performance', COALESCE(task_performance, '{}'::JSON),
        'system_health', COALESCE(system_health, '{}'::JSON),
        'coordination_quality', COALESCE(coordination_quality, '{}'::JSON)
    );

    RETURN report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =====================================================================================

-- Function to archive old coordination events
CREATE OR REPLACE FUNCTION public.archive_old_events(
    older_than INTERVAL DEFAULT '30 days',
    batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER := 0;
    batch_count INTEGER;
BEGIN
    LOOP
        -- Delete events in batches to avoid long locks
        DELETE FROM public.coordination_events
        WHERE id IN (
            SELECT id 
            FROM public.coordination_events
            WHERE created_at < NOW() - older_than
            ORDER BY created_at
            LIMIT batch_size
        );

        GET DIAGNOSTICS batch_count = ROW_COUNT;
        archived_count := archived_count + batch_count;

        -- Exit when no more rows to process
        EXIT WHEN batch_count = 0;

        -- Small delay between batches
        PERFORM pg_sleep(0.1);
    END LOOP;

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to vacuum and analyze swarm tables
CREATE OR REPLACE FUNCTION public.maintain_swarm_tables()
RETURNS TEXT AS $$
DECLARE
    maintenance_log TEXT := '';
BEGIN
    -- This function would typically contain VACUUM and ANALYZE commands
    -- but those require superuser privileges, so we'll log maintenance needs instead
    
    maintenance_log := 'Maintenance check completed at ' || NOW()::TEXT || E'\n';
    
    -- Check table sizes and recommend maintenance
    maintenance_log := maintenance_log || 'Recommended maintenance:' || E'\n';
    
    -- Check coordination_events table size
    IF (SELECT COUNT(*) FROM public.coordination_events) > 100000 THEN
        maintenance_log := maintenance_log || '- Archive old coordination events' || E'\n';
    END IF;
    
    -- Check performance_metrics table size
    IF (SELECT COUNT(*) FROM public.performance_metrics) > 500000 THEN
        maintenance_log := maintenance_log || '- Archive old performance metrics' || E'\n';
    END IF;
    
    -- Check health_checks table size
    IF (SELECT COUNT(*) FROM public.health_checks) > 100000 THEN
        maintenance_log := maintenance_log || '- Archive old health checks' || E'\n';
    END IF;

    RETURN maintenance_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- GRANT PERMISSIONS AND COMMENTS
-- =====================================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_network_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_scale_network(UUID, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_agent_efficiency(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_agent_for_task(UUID, JSONB, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.optimize_task_assignment(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_task_criticality(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_memory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.optimize_memory_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_performance_report(UUID, INTERVAL) TO authenticated;

-- Service role gets full access
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Comments for documentation
COMMENT ON FUNCTION public.get_network_stats(UUID) IS 'Get comprehensive statistics for a swarm network';
COMMENT ON FUNCTION public.auto_scale_network(UUID, REAL) IS 'Recommend auto-scaling actions based on network load';
COMMENT ON FUNCTION public.calculate_agent_efficiency(UUID) IS 'Calculate efficiency score for an agent';
COMMENT ON FUNCTION public.find_optimal_agent_for_task(UUID, JSONB, TEXT, BOOLEAN) IS 'Find the best agent for a specific task';
COMMENT ON FUNCTION public.optimize_task_assignment(UUID, INTEGER) IS 'Optimize agent assignment for a task';
COMMENT ON FUNCTION public.calculate_task_criticality(UUID) IS 'Calculate criticality score for a task';
COMMENT ON FUNCTION public.cleanup_expired_memory() IS 'Clean up expired memory entries';
COMMENT ON FUNCTION public.optimize_memory_usage(UUID, INTEGER) IS 'Optimize memory usage by removing low-priority entries';
COMMENT ON FUNCTION public.generate_performance_report(UUID, INTERVAL) IS 'Generate comprehensive performance report for a network';
COMMENT ON FUNCTION public.archive_old_events(INTERVAL, INTEGER) IS 'Archive old coordination events in batches';
COMMENT ON FUNCTION public.maintain_swarm_tables() IS 'Check and recommend maintenance for swarm tables';