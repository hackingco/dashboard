import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenEstimator,
  TokenEstimationStrategy,
  ContentType,
  estimateTokens,
  estimateConversationTokens,
  calculateTokenCost
} from '../../../src/utils/token-estimator';

describe('TokenEstimator', () => {
  let estimator: TokenEstimator;

  beforeEach(() => {
    estimator = new TokenEstimator({
      strategy: TokenEstimationStrategy.HYBRID,
      enableCaching: false // Disable for tests
    });
  });

  describe('Basic token estimation', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello, world!';
      const tokens = estimator.estimateTokens(text);
      
      // With hybrid strategy, this includes overhead
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(20);
    });

    it('should estimate tokens for longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const tokens = estimator.estimateTokens(text);
      
      // With hybrid strategy and overhead
      expect(tokens).toBeGreaterThan(15);
      expect(tokens).toBeLessThan(30);
    });

    it('should handle empty text', () => {
      expect(estimator.estimateTokens('')).toBe(0);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const tokens = estimator.estimateTokens(text);
      
      // Special characters typically use more tokens
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('Content type detection', () => {
    it('should detect plain text', () => {
      const text = 'This is a simple paragraph of text.';
      expect(estimator.detectContentType(text)).toBe(ContentType.TEXT);
    });

    it('should detect code', () => {
      const code = `
function hello() {
  console.log("Hello, world!");
  return true;
}`;
      // Small code snippets may be detected as mixed
      const detectedType = estimator.detectContentType(code);
      expect([ContentType.CODE, ContentType.MIXED]).toContain(detectedType);
    });

    it('should detect markdown', () => {
      const markdown = `
# Title
## Subtitle
- Item 1
- Item 2
[Link](https://example.com)`;
      expect(estimator.detectContentType(markdown)).toBe(ContentType.MARKDOWN);
    });

    it('should detect JSON', () => {
      const json = '{"name": "test", "value": 123}';
      expect(estimator.detectContentType(json)).toBe(ContentType.JSON);
    });

    it('should detect mixed content', () => {
      const mixed = `
# Code Example
Here's some code:
\`\`\`js
console.log("test");
\`\`\``;
      expect(estimator.detectContentType(mixed)).toBe(ContentType.MIXED);
    });
  });

  describe('Model-specific estimation', () => {
    it('should estimate differently for Claude models', () => {
      const text = 'This is a test sentence for token estimation.';
      
      const claude3Opus = estimator.estimateTokens(text, 'claude-3-opus');
      const claude3Sonnet = estimator.estimateTokens(text, 'claude-3-sonnet');
      const claude21 = estimator.estimateTokens(text, 'claude-2.1');
      
      // All should be in similar range
      expect(Math.abs(claude3Opus - claude3Sonnet)).toBeLessThan(3);
      expect(Math.abs(claude3Sonnet - claude21)).toBeLessThan(3);
    });

    it('should estimate for GPT models', () => {
      const text = 'This is a test sentence for token estimation.';
      
      const gpt4 = estimator.estimateTokens(text, 'gpt-4');
      const gpt35 = estimator.estimateTokens(text, 'gpt-3.5-turbo');
      
      // GPT models should have similar tokenization
      expect(Math.abs(gpt4 - gpt35)).toBeLessThanOrEqual(3);
    });

    it('should handle unknown models', () => {
      const text = 'Test text';
      const tokens = estimator.estimateTokens(text, 'unknown-model-xyz');
      
      // Should still provide reasonable estimate
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });
  });

  describe('Content type multipliers', () => {
    it('should apply code multiplier', () => {
      const text = 'function test() { return true; }';
      
      const textTokens = estimator.estimateTokens(text, 'claude-3-sonnet', ContentType.TEXT);
      const codeTokens = estimator.estimateTokens(text, 'claude-3-sonnet', ContentType.CODE);
      
      // Code should use more tokens
      expect(codeTokens).toBeGreaterThan(textTokens);
    });

    it('should apply markdown multiplier', () => {
      const text = '# Title\n## Subtitle\n- Item';
      
      const textTokens = estimator.estimateTokens(text, 'claude-3-sonnet', ContentType.TEXT);
      const mdTokens = estimator.estimateTokens(text, 'claude-3-sonnet', ContentType.MARKDOWN);
      
      // Markdown should use more tokens
      expect(mdTokens).toBeGreaterThan(textTokens);
    });
  });

  describe('Conversation token estimation', () => {
    it('should estimate tokens for conversation', () => {
      const messages = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there! How can I help you?' },
        { role: 'user', content: 'What is the weather like?' },
        { role: 'assistant', content: 'I don\'t have access to real-time weather data.' }
      ];
      
      const usage = estimator.estimateConversationTokens(messages);
      
      expect(usage.input).toBeGreaterThan(0);
      expect(usage.output).toBeGreaterThan(0);
      expect(usage.total).toBe(usage.input + usage.output);
      
      // User messages should be input
      expect(usage.input).toBeGreaterThan(10);
      
      // Assistant messages should be output
      expect(usage.output).toBeGreaterThan(15);
    });
  });

  describe('Cost calculation', () => {
    it('should calculate cost for Claude models', () => {
      const tokens = { input: 1000, output: 2000 };
      
      const opusCost = estimator.calculateCost(tokens, 'claude-3-opus');
      const sonnetCost = estimator.calculateCost(tokens, 'claude-3-sonnet');
      const haikuCost = estimator.calculateCost(tokens, 'claude-3-haiku');
      
      // Opus > Sonnet > Haiku
      expect(opusCost).toBeGreaterThan(sonnetCost);
      expect(sonnetCost).toBeGreaterThan(haikuCost);
      
      // Verify specific costs
      expect(opusCost).toBeCloseTo(0.165, 3); // 1000 * 0.015 + 2000 * 0.075 = 165 / 1000
      expect(sonnetCost).toBeCloseTo(0.033, 3); // 1000 * 0.003 + 2000 * 0.015 = 33 / 1000
    });

    it('should calculate cost for GPT models', () => {
      const tokens = { input: 1000, output: 1000 };
      
      const gpt4Cost = estimator.calculateCost(tokens, 'gpt-4');
      const gpt35Cost = estimator.calculateCost(tokens, 'gpt-3.5-turbo');
      
      // GPT-4 > GPT-3.5
      expect(gpt4Cost).toBeGreaterThan(gpt35Cost);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', () => {
      const cachedEstimator = new TokenEstimator({
        strategy: TokenEstimationStrategy.SIMPLE,
        enableCaching: true
      });
      
      const text = 'This is a test for caching.';
      
      // First call
      const start1 = performance.now();
      const tokens1 = cachedEstimator.estimateTokens(text);
      const time1 = performance.now() - start1;
      
      // Second call (should be cached)
      const start2 = performance.now();
      const tokens2 = cachedEstimator.estimateTokens(text);
      const time2 = performance.now() - start2;
      
      expect(tokens1).toBe(tokens2);
      // Cached call should be much faster
      expect(time2).toBeLessThan(time1 * 0.5);
      
      // Check cache stats
      const stats = cachedEstimator.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should respect cache size limit', () => {
      const cachedEstimator = new TokenEstimator({
        enableCaching: true,
        maxCacheSize: 3
      });
      
      // Add more than cache limit
      for (let i = 0; i < 5; i++) {
        cachedEstimator.estimateTokens(`Text ${i}`);
      }
      
      const stats = cachedEstimator.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(3);
    });

    it('should clear cache', () => {
      const cachedEstimator = new TokenEstimator({
        enableCaching: true
      });
      
      cachedEstimator.estimateTokens('Test');
      expect(cachedEstimator.getCacheStats().size).toBe(1);
      
      cachedEstimator.clearCache();
      expect(cachedEstimator.getCacheStats().size).toBe(0);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle emojis', () => {
      const text = 'Hello 👋 World 🌍!';
      const tokens = estimator.estimateTokens(text);
      
      // Emojis typically use more tokens
      expect(tokens).toBeGreaterThan(5);
    });

    it('should handle non-ASCII characters', () => {
      const text = '你好世界 こんにちは мир';
      const tokens = estimator.estimateTokens(text);
      
      // Non-ASCII characters use more tokens
      expect(tokens).toBeGreaterThan(10);
    });

    it('should handle mixed scripts', () => {
      const text = 'Hello 你好 Bonjour مرحبا';
      const tokens = estimator.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(8);
    });
  });

  describe('Strategy differences', () => {
    it('should produce different results for different strategies', () => {
      const text = 'This is a test sentence with some complexity.';
      
      const simple = new TokenEstimator({ 
        strategy: TokenEstimationStrategy.SIMPLE,
        enableCaching: false 
      });
      const claude = new TokenEstimator({ 
        strategy: TokenEstimationStrategy.CLAUDE,
        enableCaching: false 
      });
      const unicode = new TokenEstimator({ 
        strategy: TokenEstimationStrategy.UNICODE,
        enableCaching: false 
      });
      
      const simpleTokens = simple.estimateTokens(text);
      const claudeTokens = claude.estimateTokens(text);
      const unicodeTokens = unicode.estimateTokens(text);
      
      // All should be reasonable estimates
      [simpleTokens, claudeTokens, unicodeTokens].forEach(tokens => {
        expect(tokens).toBeGreaterThan(5);
        expect(tokens).toBeLessThan(30);
      });
      
      // But may differ slightly
      expect(new Set([simpleTokens, claudeTokens, unicodeTokens]).size).toBeGreaterThan(1);
    });
  });

  describe('Utility functions', () => {
    it('should work with quick estimation function', () => {
      const tokens = estimateTokens('Quick test');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should work with conversation estimation function', () => {
      const usage = estimateConversationTokens([
        { role: 'user', content: 'Test' },
        { role: 'assistant', content: 'Response' }
      ]);
      
      expect(usage.input).toBeGreaterThan(0);
      expect(usage.output).toBeGreaterThan(0);
    });

    it('should work with cost calculation function', () => {
      const cost = calculateTokenCost(
        { input: 1000, output: 1000 },
        'claude-3-sonnet'
      );
      
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      const tokens = estimator.estimateTokens(longText);
      
      // Actual estimation is more conservative
      expect(tokens).toBeGreaterThan(500);
      expect(tokens).toBeLessThan(1500);
    });

    it('should handle text with only whitespace', () => {
      const whitespace = '   \n\t\r   ';
      const tokens = estimator.estimateTokens(whitespace);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(15);
    });

    it('should handle text with repeated patterns', () => {
      const repeated = 'test '.repeat(100);
      const tokens = estimator.estimateTokens(repeated);
      
      // Should be roughly 100 tokens (one per "test")
      expect(tokens).toBeGreaterThan(90);
      expect(tokens).toBeLessThan(150);
    });
  });
});