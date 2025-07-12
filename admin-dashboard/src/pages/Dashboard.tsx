import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Activity, Users, Monitor, Zap, ArrowUp, ArrowDown } from 'lucide-react';

const stats = [
  {
    name: 'Active Swarms',
    value: '12',
    change: '+2',
    changeType: 'increase',
    icon: Users,
  },
  {
    name: 'Running Workers',
    value: '48',
    change: '+5',
    changeType: 'increase',
    icon: Monitor,
  },
  {
    name: 'Tasks Completed',
    value: '1,284',
    change: '+18%',
    changeType: 'increase',
    icon: Activity,
  },
  {
    name: 'System Load',
    value: '67%',
    change: '-3%',
    changeType: 'decrease',
    icon: Zap,
  },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Monitor and manage your swarm infrastructure</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs flex items-center gap-1 mt-1">
                {stat.changeType === 'increase' ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={stat.changeType === 'increase' ? 'text-green-500' : 'text-red-500'}>
                  {stat.change}
                </span>
                <span className="text-gray-400">from last hour</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events from your swarm network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { time: '2 minutes ago', event: 'New swarm "data-processing-01" created', type: 'success' },
              { time: '5 minutes ago', event: 'Worker node-23 joined swarm "api-backend"', type: 'info' },
              { time: '12 minutes ago', event: 'Task "image-resize-batch" completed', type: 'success' },
              { time: '18 minutes ago', event: 'Swarm "ml-training" scaled up to 8 workers', type: 'info' },
              { time: '25 minutes ago', event: 'Worker node-19 disconnected', type: 'warning' },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5",
                  activity.type === 'success' && "bg-green-500",
                  activity.type === 'info' && "bg-blue-500",
                  activity.type === 'warning' && "bg-yellow-500"
                )} />
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-gray-300">{activity.event}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>Create New Swarm</Button>
            <Button variant="outline">Deploy Workers</Button>
            <Button variant="outline">View All Logs</Button>
            <Button variant="outline">System Health Check</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}