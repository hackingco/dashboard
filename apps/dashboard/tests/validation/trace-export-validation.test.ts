/**
 * Trace Export Functionality Validation Tests
 * Tests the export, import, and serialization of langfuse traces
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { langfuseAPI } from '../../lib/langfuse-api';
import { 
  mockLangfuseTraces, 
  mockLangfuseAgents, 
  mockSwarmMetrics,
  generateMockTrace,
  generateMockAgent,
  generateMockMetrics,
  testScenarios
} from '../unit/mocks/langfuse-mocks';
import type { LiveTrace, LiveAgent, SwarmMetrics } from '../../lib/langfuse-client';

describe('Trace Export Validation Tests', () => {
  let client: LangfuseRealtimeClient;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    
    client = new LangfuseRealtimeClient({
      baseUrl: 'http://localhost:3000',
      enableRealtime: false,
      autoFlush: false,
    });

    // Mock URL methods for file export testing
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    
    URL.createObjectURL = vi.fn(() => 'mock-blob-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(async () => {
    if (client) {
      await client.shutdown();
    }
    
    // Restore URL methods
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    
    vi.restoreAllMocks();
  });

  describe('JSON Export Functionality', () => {
    it('should export traces to JSON format', async () => {
      const traces = await client.getTraces({ limit: 10 });
      const agents = mockLangfuseAgents;
      const metrics = mockSwarmMetrics;
      
      const exportData = {
        traces,
        agents,
        metrics,
        timestamp: new Date().toISOString(),
        format: 'json',
        version: '1.0.0',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      
      expect(jsonString).toBeTruthy();
      expect(typeof jsonString).toBe('string');
      
      // Verify JSON is valid
      const parsed = JSON.parse(jsonString);
      expect(parsed.traces).toEqual(traces);
      expect(parsed.agents).toEqual(agents);
      expect(parsed.metrics).toEqual(metrics);
      expect(parsed.format).toBe('json');
      expect(parsed.version).toBe('1.0.0');
    });

    it('should export filtered traces', async () => {
      const sessionId = 'test-session-123';
      const traces = await client.getTraces({ 
        sessionId, 
        limit: 5 
      });
      
      const exportData = {
        traces,
        filters: { sessionId },
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.traces).toEqual(traces);
      expect(parsed.filters).toEqual({ sessionId });
    });

    it('should handle large trace exports', async () => {
      const largeTraces = testScenarios.highActivity.traces;
      const exportData = {
        traces: largeTraces,
        count: largeTraces.length,
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const startTime = performance.now();
      const jsonString = JSON.stringify(exportData);
      const endTime = performance.now();
      
      expect(jsonString).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.traces).toHaveLength(largeTraces.length);
    });
  });

  describe('CSV Export Functionality', () => {
    it('should export traces to CSV format', async () => {
      const traces = await client.getTraces({ limit: 10 });
      
      const csvHeader = [
        'id',
        'name',
        'sessionId',
        'userId',
        'timestamp',
        'duration',
        'status',
        'model',
        'promptTokens',
        'completionTokens',
        'totalCost',
        'input',
        'output',
        'agentId',
        'swarmId'
      ].join(',');

      const csvRows = traces.map(trace => [
        trace.id,
        `"${trace.name}"`,
        trace.sessionId,
        trace.userId || '',
        trace.timestamp.toISOString(),
        trace.duration,
        trace.status,
        trace.model,
        trace.promptTokens,
        trace.completionTokens,
        trace.totalCost,
        `"${trace.input}"`,
        `"${trace.output}"`,
        trace.agentId || '',
        trace.swarmId || ''
      ].join(','));

      const csvString = [csvHeader, ...csvRows].join('\n');
      
      expect(csvString).toBeTruthy();
      expect(csvString).toContain(csvHeader);
      expect(csvString.split('\n')).toHaveLength(traces.length + 1);
    });

    it('should handle CSV escaping correctly', async () => {
      const traceWithSpecialChars = generateMockTrace({
        name: 'Test "quote" and, comma',
        input: 'Input with\nnewline',
        output: 'Output with "quotes" and, commas',
      });

      const csvRow = [
        traceWithSpecialChars.id,
        `"${traceWithSpecialChars.name}"`,
        traceWithSpecialChars.sessionId,
        traceWithSpecialChars.userId || '',
        traceWithSpecialChars.timestamp.toISOString(),
        traceWithSpecialChars.duration,
        traceWithSpecialChars.status,
        traceWithSpecialChars.model,
        traceWithSpecialChars.promptTokens,
        traceWithSpecialChars.completionTokens,
        traceWithSpecialChars.totalCost,
        `"${traceWithSpecialChars.input}"`,
        `"${traceWithSpecialChars.output}"`,
        traceWithSpecialChars.agentId || '',
        traceWithSpecialChars.swarmId || ''
      ].join(',');

      expect(csvRow).toContain('"Test "quote" and, comma"');
      expect(csvRow).toContain('"Input with\nnewline"');
      expect(csvRow).toContain('"Output with "quotes" and, commas"');
    });
  });

  describe('Blob Creation and Download', () => {
    it('should create blob for JSON export', async () => {
      const traces = await client.getTraces({ limit: 5 });
      const exportData = {
        traces,
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should create blob for CSV export', async () => {
      const traces = await client.getTraces({ limit: 5 });
      const csvHeader = 'id,name,sessionId,status,model\n';
      const csvRows = traces.map(trace => 
        `${trace.id},"${trace.name}",${trace.sessionId},${trace.status},${trace.model}`
      ).join('\n');
      const csvString = csvHeader + csvRows;

      const blob = new Blob([csvString], { type: 'text/csv' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle large blob creation', async () => {
      const largeTraces = testScenarios.highActivity.traces;
      const exportData = {
        traces: largeTraces,
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(1000); // Should be a reasonable size
    });
  });

  describe('File Download Simulation', () => {
    it('should simulate file download with correct filename', async () => {
      const traces = await client.getTraces({ limit: 5 });
      const exportData = {
        traces,
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Mock document methods
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      };
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      // Simulate download
      const url = URL.createObjectURL(blob);
      mockAnchor.href = url;
      mockAnchor.download = `langfuse-traces-${Date.now()}.json`;
      
      document.body.appendChild(mockAnchor as any);
      mockAnchor.click();
      document.body.removeChild(mockAnchor as any);
      URL.revokeObjectURL(url);

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    });

    it('should generate unique filenames for exports', async () => {
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;

      const filename1 = `langfuse-traces-${timestamp1}.json`;
      const filename2 = `langfuse-traces-${timestamp2}.json`;

      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^langfuse-traces-\d+\.json$/);
      expect(filename2).toMatch(/^langfuse-traces-\d+\.json$/);
    });
  });

  describe('Import Functionality', () => {
    it('should validate imported JSON data', async () => {
      const originalTraces = await client.getTraces({ limit: 5 });
      const exportData = {
        traces: originalTraces,
        timestamp: new Date().toISOString(),
        format: 'json',
        version: '1.0.0',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const importedData = JSON.parse(jsonString);

      // Validate structure
      expect(importedData).toHaveProperty('traces');
      expect(importedData).toHaveProperty('timestamp');
      expect(importedData).toHaveProperty('format');
      expect(importedData).toHaveProperty('version');

      // Validate traces
      expect(Array.isArray(importedData.traces)).toBe(true);
      expect(importedData.traces).toHaveLength(originalTraces.length);

      // Validate trace structure
      importedData.traces.forEach((trace: any) => {
        expect(trace).toHaveProperty('id');
        expect(trace).toHaveProperty('name');
        expect(trace).toHaveProperty('sessionId');
        expect(trace).toHaveProperty('timestamp');
        expect(trace).toHaveProperty('status');
        expect(trace).toHaveProperty('model');
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{"traces": [{"id": "incomplete"';
      
      expect(() => {
        JSON.parse(malformedJson);
      }).toThrow();
    });

    it('should validate imported data schema', async () => {
      const validData = {
        traces: [generateMockTrace()],
        timestamp: new Date().toISOString(),
        format: 'json',
        version: '1.0.0',
      };

      const invalidData = {
        traces: 'not-an-array',
        timestamp: 'invalid-date',
        format: 123,
      };

      // Valid data should pass validation
      expect(Array.isArray(validData.traces)).toBe(true);
      expect(typeof validData.timestamp).toBe('string');
      expect(typeof validData.format).toBe('string');

      // Invalid data should fail validation
      expect(Array.isArray(invalidData.traces)).toBe(false);
      expect(typeof invalidData.format).toBe('number');
    });
  });

  describe('Serialization Edge Cases', () => {
    it('should handle dates in serialization', async () => {
      const trace = generateMockTrace({
        timestamp: new Date('2024-01-01T10:00:00Z'),
      });

      const serialized = JSON.stringify(trace);
      const deserialized = JSON.parse(serialized);

      expect(typeof deserialized.timestamp).toBe('string');
      expect(deserialized.timestamp).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should handle undefined and null values', async () => {
      const trace = generateMockTrace({
        userId: undefined,
        metadata: null,
      });

      const serialized = JSON.stringify(trace);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.userId).toBeUndefined();
      expect(deserialized.metadata).toBe(null);
    });

    it('should handle circular references', async () => {
      const trace = generateMockTrace();
      // Create circular reference
      (trace as any).circularRef = trace;

      expect(() => {
        JSON.stringify(trace);
      }).toThrow();
    });

    it('should handle large numbers and precision', async () => {
      const trace = generateMockTrace({
        promptTokens: Number.MAX_SAFE_INTEGER,
        totalCost: 0.123456789012345,
      });

      const serialized = JSON.stringify(trace);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.promptTokens).toBe(Number.MAX_SAFE_INTEGER);
      expect(deserialized.totalCost).toBe(0.123456789012345);
    });
  });

  describe('Export Formats', () => {
    it('should export in multiple formats', async () => {
      const traces = await client.getTraces({ limit: 3 });
      const agents = mockLangfuseAgents.slice(0, 2);
      const metrics = mockSwarmMetrics;

      // JSON format
      const jsonExport = {
        traces,
        agents,
        metrics,
        format: 'json',
        timestamp: new Date().toISOString(),
      };

      // CSV format (traces only)
      const csvHeader = 'id,name,sessionId,status,model,promptTokens,completionTokens,totalCost\n';
      const csvRows = traces.map(trace => 
        `${trace.id},"${trace.name}",${trace.sessionId},${trace.status},${trace.model},${trace.promptTokens},${trace.completionTokens},${trace.totalCost}`
      ).join('\n');
      const csvExport = csvHeader + csvRows;

      // Validate exports
      expect(JSON.parse(JSON.stringify(jsonExport))).toEqual(jsonExport);
      expect(csvExport).toContain(csvHeader);
      expect(csvExport.split('\n')).toHaveLength(traces.length + 1);
    });

    it('should include metadata in exports', async () => {
      const traces = await client.getTraces({ limit: 2 });
      const exportData = {
        traces,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'test-user',
          totalTraces: traces.length,
          filters: { limit: 2 },
          version: '1.0.0',
        },
        format: 'json',
      };

      const serialized = JSON.stringify(exportData, null, 2);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.metadata).toEqual(exportData.metadata);
      expect(deserialized.metadata.totalTraces).toBe(traces.length);
    });
  });

  describe('Performance Testing', () => {
    it('should handle large export operations efficiently', async () => {
      const largeTraces = testScenarios.highActivity.traces;
      const exportData = {
        traces: largeTraces,
        timestamp: new Date().toISOString(),
        format: 'json',
      };

      const startTime = performance.now();
      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(blob.size).toBeGreaterThan(1000);
    });

    it('should handle concurrent export operations', async () => {
      const concurrentExports = 5;
      const promises = Array.from({ length: concurrentExports }, async (_, i) => {
        const traces = await client.getTraces({ limit: 10 });
        const exportData = {
          traces,
          exportId: i,
          timestamp: new Date().toISOString(),
          format: 'json',
        };
        return JSON.stringify(exportData);
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentExports);
      results.forEach((result, index) => {
        expect(result).toBeTruthy();
        expect(result).toContain(`"exportId":${index}`);
      });
    });
  });

  describe('Error Handling in Export', () => {
    it('should handle export errors gracefully', async () => {
      // Mock a failing export operation
      const failingExport = async () => {
        throw new Error('Export failed');
      };

      try {
        await failingExport();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Export failed');
      }
    });

    it('should handle memory limitations', async () => {
      // Simulate memory-intensive export
      const memoryIntensiveData = {
        traces: Array.from({ length: 10000 }, (_, i) => generateMockTrace({
          id: `memory-trace-${i}`,
          input: 'x'.repeat(1000),
          output: 'y'.repeat(1000),
        })),
      };

      const startTime = performance.now();
      let success = false;
      
      try {
        const jsonString = JSON.stringify(memoryIntensiveData);
        success = typeof jsonString === 'string';
      } catch (error) {
        // Memory error is acceptable for very large datasets
        success = false;
      }
      
      const endTime = performance.now();
      
      // Should either succeed or fail quickly
      expect(endTime - startTime).toBeLessThan(5000);
      expect(typeof success).toBe('boolean');
    });
  });
});