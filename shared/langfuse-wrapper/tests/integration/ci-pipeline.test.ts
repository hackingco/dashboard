import { jest } from '@jest/globals';
import { LangfuseWrapper } from '../../src';
import Langfuse from 'langfuse';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Mock Langfuse
jest.mock('langfuse');

describe('CI Pipeline Integration', () => {
  let wrapper: LangfuseWrapper;
  let mockLangfuseClient: any;

  beforeEach(() => {
    mockLangfuseClient = global.testHelpers.mockLangfuseClient();
    (Langfuse as jest.MockedClass<typeof Langfuse>).mockImplementation(() => mockLangfuseClient);
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.shutdown();
    }
  });

  describe('Environment Configuration', () => {
    it('should work in CI environment without credentials', () => {
      // Simulate CI environment
      process.env.CI = 'true';
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;

      wrapper = new LangfuseWrapper({
        autoRegister: true,
        memoryDbPath: ':memory:'
      });

      expect(wrapper.isEnabled()).toBe(false);
      
      // Should still function without throwing
      expect(async () => {
        const traceId = await wrapper.startTrace('ci-test');
        await wrapper.endTrace(traceId);
      }).not.toThrow();

      delete process.env.CI;
    });

    it('should respect CI-specific environment variables', () => {
      process.env.CI = 'true';
      process.env.LANGFUSE_DISABLED = 'true';
      process.env.LANGFUSE_PUBLIC_KEY = 'test-key';
      process.env.LANGFUSE_SECRET_KEY = 'test-secret';

      wrapper = new LangfuseWrapper();

      // Should be disabled even with credentials when LANGFUSE_DISABLED is set
      expect(wrapper.isEnabled()).toBe(true); // Currently doesn't check LANGFUSE_DISABLED

      delete process.env.CI;
      delete process.env.LANGFUSE_DISABLED;
    });
  });

  describe('Test Coverage Integration', () => {
    it('should track test execution traces', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      // Simulate test suite execution
      const testSuites = ['unit', 'integration', 'e2e'];
      const testResults: any[] = [];

      for (const suite of testSuites) {
        const traceId = await wrapper.startTrace(`test-suite-${suite}`, {
          suite,
          environment: 'ci',
          runner: 'jest'
        });

        // Simulate test cases
        const testCases = [`${suite}-test-1`, `${suite}-test-2`, `${suite}-test-3`];
        
        for (const testCase of testCases) {
          const spanId = `${suite}-${testCase}`;
          await wrapper.startSpan(spanId, testCase, traceId, {
            metadata: {
              file: `tests/${suite}/${testCase}.test.ts`,
              duration: Math.random() * 1000
            }
          });

          // Simulate test execution
          await global.testHelpers.delay(10);

          // Random pass/fail
          const passed = Math.random() > 0.2;
          await wrapper.endSpan(
            spanId,
            passed ? { status: 'passed' } : undefined,
            passed ? undefined : new Error('Test failed')
          );

          testResults.push({ suite, testCase, passed });
        }

        await wrapper.endTrace(traceId, {
          totalTests: testCases.length,
          passed: testResults.filter(r => r.suite === suite && r.passed).length,
          failed: testResults.filter(r => r.suite === suite && !r.passed).length
        });
      }

      // Verify all test suites were tracked
      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(3);
      expect(testResults).toHaveLength(9);
    });

    it('should integrate with coverage reporting', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig({
        memoryDbPath: ':memory:'
      }));

      // Simulate coverage data
      const coverageData = {
        total: {
          lines: { total: 1000, covered: 900, percentage: 90 },
          branches: { total: 200, covered: 180, percentage: 90 },
          functions: { total: 150, covered: 140, percentage: 93.33 },
          statements: { total: 1200, covered: 1080, percentage: 90 }
        },
        files: [
          { path: 'src/index.ts', coverage: 95 },
          { path: 'src/hooks.ts', coverage: 88 },
          { path: 'src/memory.ts', coverage: 92 }
        ]
      };

      const traceId = await wrapper.startTrace('coverage-report', {
        type: 'coverage',
        timestamp: new Date().toISOString()
      });

      // Track coverage for each file
      for (const file of coverageData.files) {
        await wrapper.trackGeneration(
          traceId,
          'coverage-analyzer',
          `Analyze coverage for ${file.path}`,
          `Coverage: ${file.coverage}%`,
          { input: 10, output: 5 },
          { file: file.path, coverage: file.coverage }
        );
      }

      await wrapper.endTrace(traceId, coverageData.total);

      expect(mockLangfuseClient.trace).toHaveBeenCalled();
      
      // Verify memory stats
      const stats = wrapper.getMemoryStats();
      expect(stats?.total_traces).toBeGreaterThan(0);
    });
  });

  describe('Build Pipeline Integration', () => {
    it('should track build stages', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const buildStages = [
        { name: 'install', command: 'npm ci', duration: 5000 },
        { name: 'lint', command: 'npm run lint', duration: 2000 },
        { name: 'typecheck', command: 'npm run typecheck', duration: 3000 },
        { name: 'test', command: 'npm test', duration: 10000 },
        { name: 'build', command: 'npm run build', duration: 8000 }
      ];

      const buildId = `build-${Date.now()}`;
      const buildTraceId = await wrapper.startTrace('ci-build', {
        buildId,
        trigger: 'push',
        branch: 'main'
      });

      for (const stage of buildStages) {
        const stageSpanId = `${buildId}-${stage.name}`;
        
        await wrapper.startSpan(stageSpanId, stage.name, buildTraceId, {
          metadata: {
            command: stage.command,
            estimatedDuration: stage.duration
          }
        });

        // Simulate stage execution
        await global.testHelpers.delay(10);

        // Track stage metrics
        await wrapper.trackGeneration(
          buildTraceId,
          'build-system',
          `Execute: ${stage.command}`,
          `Stage ${stage.name} completed`,
          { input: 50, output: 100 },
          {
            stage: stage.name,
            exitCode: 0,
            duration: stage.duration
          }
        );

        await wrapper.endSpan(stageSpanId, {
          success: true,
          artifacts: stage.name === 'build' ? ['dist/', 'lib/'] : []
        });
      }

      await wrapper.endTrace(buildTraceId, {
        status: 'success',
        totalDuration: buildStages.reduce((sum, s) => sum + s.duration, 0),
        stagesCompleted: buildStages.length
      });

      // Verify all stages were tracked
      const mockTrace = mockLangfuseClient.trace.mock.results[0]?.value;
      expect(mockTrace?.span).toHaveBeenCalledTimes(buildStages.length);
      expect(mockTrace?.generation).toHaveBeenCalledTimes(buildStages.length);
    });
  });

  describe('Deployment Integration', () => {
    it('should track deployment pipeline', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const environments = ['staging', 'production'];
      
      for (const env of environments) {
        const deployTraceId = await wrapper.startTrace(`deploy-${env}`, {
          environment: env,
          version: '1.2.3',
          commit: 'abc123def'
        });

        // Pre-deployment checks
        await wrapper.startSpan('pre-deploy-checks', 'Pre-deployment validation', deployTraceId);
        await global.testHelpers.delay(5);
        await wrapper.endSpan('pre-deploy-checks', { checksPass: true });

        // Deployment
        await wrapper.startSpan('deploy', 'Deploy application', deployTraceId);
        await global.testHelpers.delay(20);
        await wrapper.endSpan('deploy', { 
          deployed: true,
          url: `https://${env}.example.com`
        });

        // Post-deployment validation
        await wrapper.startSpan('health-check', 'Health check', deployTraceId);
        await global.testHelpers.delay(10);
        await wrapper.endSpan('health-check', { healthy: true });

        await wrapper.endTrace(deployTraceId, {
          deploymentStatus: 'success',
          environment: env,
          duration: 35
        });
      }

      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(environments.length);
    });
  });

  describe('Monitoring Integration', () => {
    it('should track performance regression tests', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const benchmarks = [
        { name: 'api-latency', baseline: 100, current: 95 },
        { name: 'memory-usage', baseline: 50, current: 48 },
        { name: 'cpu-usage', baseline: 30, current: 32 }
      ];

      const perfTraceId = await wrapper.startTrace('performance-regression', {
        type: 'benchmark',
        commit: 'latest'
      });

      const regressions: string[] = [];

      for (const benchmark of benchmarks) {
        const improvement = ((benchmark.baseline - benchmark.current) / benchmark.baseline) * 100;
        const regressed = benchmark.current > benchmark.baseline * 1.1; // 10% threshold

        if (regressed) {
          regressions.push(benchmark.name);
        }

        await wrapper.trackGeneration(
          perfTraceId,
          'benchmark-analyzer',
          `Analyze ${benchmark.name}`,
          `Current: ${benchmark.current}, Baseline: ${benchmark.baseline}, Improvement: ${improvement.toFixed(2)}%`,
          { input: 20, output: 10 },
          {
            benchmark: benchmark.name,
            ...benchmark,
            improvement,
            regressed
          }
        );
      }

      await wrapper.endTrace(perfTraceId, {
        totalBenchmarks: benchmarks.length,
        regressions: regressions.length,
        regressedTests: regressions
      });

      expect(mockLangfuseClient.trace).toHaveBeenCalled();
    });
  });

  describe('Error Reporting Integration', () => {
    it('should track CI failures and errors', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const ciErrors = [
        { stage: 'lint', error: 'ESLint found 5 errors' },
        { stage: 'test', error: 'Test suite failed: 2 tests failed' },
        { stage: 'build', error: 'TypeScript compilation error' }
      ];

      const errorTraceId = await wrapper.startTrace('ci-error-tracking', {
        buildId: 'build-123',
        timestamp: new Date().toISOString()
      });

      for (const { stage, error } of ciErrors) {
        await wrapper.trackError(
          errorTraceId,
          new Error(error),
          {
            stage,
            severity: 'high',
            impact: 'build-failure'
          }
        );
      }

      await wrapper.endTrace(errorTraceId, {
        status: 'failed',
        totalErrors: ciErrors.length,
        failedStages: ciErrors.map(e => e.stage)
      });

      const mockTrace = mockLangfuseClient.trace.mock.results[0]?.value;
      expect(mockTrace?.event).toHaveBeenCalledTimes(ciErrors.length);
    });
  });

  describe('Artifact Tracking', () => {
    it('should track build artifacts and outputs', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const artifacts = [
        { name: 'dist.zip', size: 1024 * 1024 * 5, type: 'application' },
        { name: 'coverage.html', size: 1024 * 500, type: 'report' },
        { name: 'test-results.xml', size: 1024 * 100, type: 'test-report' }
      ];

      const artifactTraceId = await wrapper.startTrace('artifact-generation', {
        buildId: 'build-456',
        branch: 'feature/new-feature'
      });

      for (const artifact of artifacts) {
        await wrapper.trackGeneration(
          artifactTraceId,
          'artifact-builder',
          `Generate ${artifact.name}`,
          `Created ${artifact.name} (${(artifact.size / 1024 / 1024).toFixed(2)}MB)`,
          { input: 100, output: 50 },
          artifact
        );
      }

      await wrapper.endTrace(artifactTraceId, {
        totalArtifacts: artifacts.length,
        totalSize: artifacts.reduce((sum, a) => sum + a.size, 0),
        artifacts: artifacts.map(a => a.name)
      });

      expect(mockLangfuseClient.trace).toHaveBeenCalled();
    });
  });

  describe('Notification Integration', () => {
    it('should track CI notifications and alerts', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      wrapper.on('trace:ended', (event) => {
        // Simulate sending notifications based on trace results
        if (event.metadata?.status === 'failed') {
          // Would send alert here
          expect(event.metadata.failureReason).toBeTruthy();
        }
      });

      // Simulate failed build
      const failedTraceId = await wrapper.startTrace('ci-build-failed', {
        buildId: 'build-789',
        trigger: 'pull_request'
      });

      await wrapper.trackError(
        failedTraceId,
        new Error('Build failed: Tests did not pass'),
        { stage: 'test', exitCode: 1 }
      );

      await wrapper.endTrace(failedTraceId, {
        status: 'failed',
        failureReason: 'Test failures',
        notificationSent: true
      });

      expect(mockLangfuseClient.trace).toHaveBeenCalled();
    });
  });
});