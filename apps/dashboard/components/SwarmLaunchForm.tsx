'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Rocket, Plus, Trash2 } from 'lucide-react';

interface EnvVar {
  key: string;
  value: string;
}

interface SwarmLaunchFormProps {
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

const FLY_REGIONS = [
  { value: 'ams', label: 'Amsterdam, Netherlands' },
  { value: 'cdg', label: 'Paris, France' },
  { value: 'dfw', label: 'Dallas, Texas (US)' },
  { value: 'ewr', label: 'Secaucus, NJ (US)' },
  { value: 'fra', label: 'Frankfurt, Germany' },
  { value: 'gru', label: 'São Paulo, Brazil' },
  { value: 'hkg', label: 'Hong Kong' },
  { value: 'iad', label: 'Ashburn, Virginia (US)' },
  { value: 'lax', label: 'Los Angeles, California (US)' },
  { value: 'lhr', label: 'London, United Kingdom' },
  { value: 'maa', label: 'Chennai, India' },
  { value: 'nrt', label: 'Tokyo, Japan' },
  { value: 'ord', label: 'Chicago, Illinois (US)' },
  { value: 'sea', label: 'Seattle, Washington (US)' },
  { value: 'sin', label: 'Singapore' },
  { value: 'sjc', label: 'San Jose, California (US)' },
  { value: 'syd', label: 'Sydney, Australia' },
  { value: 'yyz', label: 'Toronto, Canada' },
];

export function SwarmLaunchForm({ onSubmit, isLoading = false }: SwarmLaunchFormProps) {
  const [appName, setAppName] = useState('');
  const [region, setRegion] = useState('dfw');
  const [dockerImage, setDockerImage] = useState('');
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { key: 'NODE_ENV', value: 'production' },
    { key: 'WORKER_TYPE', value: 'general' },
  ]);

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert env vars array to object
    const env = envVars.reduce((acc, { key, value }) => {
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Add observability env vars
    env.LANGFUSE_SECRET_KEY = process.env.NEXT_PUBLIC_LANGFUSE_SECRET_KEY || '';
    env.LANGFUSE_PUBLIC_KEY = process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || '';
    env.LANGFUSE_HOST = process.env.NEXT_PUBLIC_LANGFUSE_HOST || 'https://cloud.langfuse.com';
    env.TRUSTGRAPH_API_KEY = process.env.NEXT_PUBLIC_TRUSTGRAPH_API_KEY || '';
    env.TRUSTGRAPH_API_URL = process.env.NEXT_PUBLIC_TRUSTGRAPH_API_URL || '';

    const formData = {
      appName,
      region,
      dockerImage: dockerImage || 'flyio/hellofly:latest',
      env,
      config: {
        cpus: 1,
        memory: 256,
        minInstances: 1,
        maxInstances: 10,
      },
    };

    onSubmit(formData);
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Rocket className="w-5 h-5 mr-2" />
            Launch New Swarm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* App Name */}
          <div className="space-y-2">
            <label htmlFor="appName" className="text-sm font-medium">
              App Name
            </label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="my-swarm-app"
              required
              pattern="^[a-z0-9-]+$"
              title="App name must contain only lowercase letters, numbers, and hyphens"
            />
            <p className="text-xs text-muted-foreground">
              Must be unique and contain only lowercase letters, numbers, and hyphens
            </p>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label htmlFor="region" className="text-sm font-medium">
              Region
            </label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {FLY_REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Docker Image */}
          <div className="space-y-2">
            <label htmlFor="dockerImage" className="text-sm font-medium">
              Docker Image
            </label>
            <Input
              id="dockerImage"
              value={dockerImage}
              onChange={(e) => setDockerImage(e.target.value)}
              placeholder="flyio/hellofly:latest"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use default worker image
            </p>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Environment Variables</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEnvVar}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Variable
              </Button>
            </div>
            <div className="space-y-2">
              {envVars.map((envVar, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={envVar.key}
                    onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                    placeholder="KEY"
                    className="flex-1"
                  />
                  <Input
                    value={envVar.value}
                    onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEnvVar(index)}
                    disabled={envVars.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !appName}
          >
            {isLoading ? (
              <>
                <Rocket className="w-4 h-4 mr-2 animate-pulse" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Launch Swarm
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}