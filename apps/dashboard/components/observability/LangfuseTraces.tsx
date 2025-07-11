'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Search, Filter, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface LLMTrace {
  id: string;
  name: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
  duration: number;
  status: 'success' | 'error' | 'pending';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  input: string;
  output: string;
  metadata?: Record<string, any>;
  tags?: string[];
  scores?: Record<string, number>;
}

interface LangfuseTracesProps {
  sessionId?: string;
  onTraceSelect?: (trace: LLMTrace) => void;
}

export function LangfuseTraces({ sessionId, onTraceSelect }: LangfuseTracesProps) {
  const [traces, setTraces] = useState<LLMTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Generate mock traces
  const generateMockTraces = (): LLMTrace[] => {
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];
    const statuses: ('success' | 'error' | 'pending')[] = ['success', 'error', 'pending'];
    const prompts = [
      'Analyze the requirements for the authentication system',
      'Generate test cases for the API endpoints',
      'Review the database schema design',
      'Optimize the search algorithm performance',
      'Create documentation for the new features',
    ];

    return Array.from({ length: 20 }, (_, i) => ({
      id: `trace-${i + 1}`,
      name: `Task ${i + 1}`,
      sessionId: sessionId || `session-${Math.floor(i / 5) + 1}`,
      userId: `user-${Math.floor(Math.random() * 5) + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      duration: Math.floor(Math.random() * 5000) + 500,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      model: models[Math.floor(Math.random() * models.length)],
      promptTokens: Math.floor(Math.random() * 1000) + 100,
      completionTokens: Math.floor(Math.random() * 500) + 50,
      totalCost: Math.random() * 0.5,
      input: prompts[Math.floor(Math.random() * prompts.length)],
      output: `Generated response for task ${i + 1}...`,
      metadata: {
        temperature: Math.random(),
        maxTokens: 2048,
        topP: 0.9,
      },
      tags: ['swarm', 'automation', 'production'],
      scores: {
        quality: Math.random(),
        relevance: Math.random(),
        coherence: Math.random(),
      },
    }));
  };

  useEffect(() => {
    // In production, this would fetch from Langfuse API
    setIsLoading(true);
    setTimeout(() => {
      setTraces(generateMockTraces());
      setIsLoading(false);
    }, 1000);
  }, [sessionId]);

  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trace.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trace.status === statusFilter;
    const matchesModel = modelFilter === 'all' || trace.model === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'error':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Langfuse LLM Traces
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search traces..."
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                <SelectItem value="claude-3-opus">Claude Opus</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex h-[500px]">
          {/* Trace List */}
          <div className="w-1/2 border-r overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredTraces.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No traces found
              </div>
            ) : (
              <div className="divide-y">
                {filteredTraces.map((trace) => (
                  <div
                    key={trace.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                      selectedTrace?.id === trace.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => {
                      setSelectedTrace(trace);
                      onTraceSelect?.(trace);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(trace.status)}
                          <h4 className="font-medium text-sm">{trace.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {trace.model}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {trace.input}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{trace.timestamp.toLocaleTimeString()}</span>
                          <span>{trace.duration}ms</span>
                          <span>${trace.totalCost.toFixed(4)}</span>
                          <span>{trace.promptTokens + trace.completionTokens} tokens</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trace Details */}
          <div className="w-1/2 overflow-y-auto">
            {selectedTrace ? (
              <div className="p-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">{selectedTrace.name}</h3>
                    <Badge className={getStatusColor(selectedTrace.status)}>
                      {selectedTrace.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Session ID:</span>
                      <p className="font-mono text-xs">{selectedTrace.sessionId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Model:</span>
                      <p>{selectedTrace.model}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <p>{selectedTrace.duration}ms</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Cost:</span>
                      <p>${selectedTrace.totalCost.toFixed(4)}</p>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="io" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="io">Input/Output</TabsTrigger>
                    <TabsTrigger value="metadata">Metadata</TabsTrigger>
                    <TabsTrigger value="scores">Scores</TabsTrigger>
                    <TabsTrigger value="tags">Tags</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="io" className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Input</h4>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                        {selectedTrace.input}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Output</h4>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                        {selectedTrace.output}
                      </pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="metadata">
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedTrace.metadata, null, 2)}
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="scores">
                    {selectedTrace.scores && (
                      <div className="space-y-3">
                        {Object.entries(selectedTrace.scores).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm capitalize">{key}</span>
                              <span className="text-sm font-medium">{(value * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${value * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="tags">
                    <div className="flex flex-wrap gap-2">
                      {selectedTrace.tags?.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a trace to view details
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}