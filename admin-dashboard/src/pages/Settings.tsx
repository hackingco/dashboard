import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Save, Key, Globe, Bell, Shield, Database } from 'lucide-react';

export function Settings() {
  const [apiEndpoint, setApiEndpoint] = React.useState('https://api.hacking.co');
  const [apiKey, setApiKey] = React.useState('');
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [maxWorkers, setMaxWorkers] = React.useState('100');
  const [retentionDays, setRetentionDays] = React.useState('30');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your swarm infrastructure</p>
      </div>

      {/* API Configuration */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Configure API endpoints and authentication</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Endpoint
            </label>
            <Input
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
              <Button variant="outline" className="gap-2">
                <Key className="h-4 w-4" />
                Generate
              </Button>
            </div>
          </div>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save API Settings
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure alerts and webhooks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Webhook URL
            </label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/webhook"
            />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded border-dark-700 bg-dark-900 text-accent-600" defaultChecked />
              <span className="text-sm text-gray-300">Send alerts for critical errors</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded border-dark-700 bg-dark-900 text-accent-600" defaultChecked />
              <span className="text-sm text-gray-300">Notify on swarm scaling events</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded border-dark-700 bg-dark-900 text-accent-600" />
              <span className="text-sm text-gray-300">Daily summary reports</span>
            </label>
          </div>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save Notification Settings
          </Button>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>Configure system limits and behavior</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Workers per Swarm
            </label>
            <Input
              type="number"
              value={maxWorkers}
              onChange={(e) => setMaxWorkers(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Task Timeout (seconds)
            </label>
            <Input
              type="number"
              defaultValue="300"
              placeholder="300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Auto-scaling Threshold (%)
            </label>
            <Input
              type="number"
              defaultValue="80"
              placeholder="80"
            />
          </div>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save System Settings
          </Button>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Configure data retention and cleanup</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Log Retention (days)
            </label>
            <Input
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              placeholder="30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Metrics Retention (days)
            </label>
            <Input
              type="number"
              defaultValue="90"
              placeholder="90"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline">Clean Old Data</Button>
            <Button variant="outline">Export Data</Button>
          </div>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save Data Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}