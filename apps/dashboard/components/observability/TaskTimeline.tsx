'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'worker_assigned';
  taskId: string;
  workerId?: string;
  swarmId: string;
  message: string;
  metadata?: Record<string, any>;
}

interface TaskTimelineProps {
  events: TimelineEvent[];
  maxEvents?: number;
}

export function TaskTimeline({ events, maxEvents = 20 }: TaskTimelineProps) {
  const sortedEvents = [...events]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxEvents);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'task_created':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'task_started':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'task_completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'task_failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'task_created':
        return 'bg-blue-100 text-blue-800';
      case 'task_started':
        return 'bg-yellow-100 text-yellow-800';
      case 'task_completed':
        return 'bg-green-100 text-green-800';
      case 'task_failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Task Timeline</CardTitle>
        <CardDescription>
          Recent task execution events across all swarms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No recent events
            </p>
          ) : (
            sortedEvents.map((event) => (
              <div key={event.id} className="flex gap-3 items-start">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border-2">
                    {getEventIcon(event.type)}
                  </div>
                  {sortedEvents[sortedEvents.length - 1].id !== event.id && (
                    <div className="w-0.5 h-full bg-border" />
                  )}
                </div>

                {/* Event content */}
                <div className="flex-1 space-y-1 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={getEventColor(event.type)}>
                      {event.type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{event.message}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Task: {event.taskId.slice(0, 8)}</span>
                    <span>•</span>
                    <span>Swarm: {event.swarmId}</span>
                    {event.workerId && (
                      <>
                        <span>•</span>
                        <span>Worker: {event.workerId.slice(0, 8)}</span>
                      </>
                    )}
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                      {JSON.stringify(event.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}