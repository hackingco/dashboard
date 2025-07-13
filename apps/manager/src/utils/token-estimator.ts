/**
 * Token Estimation Utilities
 * 
 * Provides accurate token counting for various LLM models including Claude,
 * GPT, and other popular models. Uses multiple estimation strategies to
 * ensure accuracy without blocking operations.
 */

import logger from '../services/logger';

/**
 * Token estimation strategies
 */
export enum TokenEstimationStrategy {
  SIMPLE = 'simple',           // Basic character/word based
  TIKTOKEN = 'tiktoken',       // OpenAI tiktoken-based
  CLAUDE = 'claude',           // Claude-specific estimation
  UNICODE = 'unicode',         // Unicode-aware estimation
  HYBRID = 'hybrid'            // Combines multiple strategies
}

/**
 * Model families for token estimation
 */
export enum ModelFamily {
  CLAUDE = 'claude',
  GPT = 'gpt',
  LLAMA = 'llama',
  MISTRAL = 'mistral',
  OTHER = 'other'
}

/**
 * Token usage interface
 */
export interface TokenUsage {
  input: number;
  output: number;
  total?: number;
}

/**
 * Content type for specialized estimation
 */
export enum ContentType {
  TEXT = 'text',
  CODE = 'code',
  MARKDOWN = 'markdown',
  JSON = 'json',
  MIXED = 'mixed'
}

/**
 * Model-specific token estimation parameters
 */
interface ModelTokenParams {
  family: ModelFamily;
  tokensPerChar: number;
  tokensPerWord: number;
  specialTokenOverhead: number;
  codeMultiplier: number;
  markdownMultiplier: number;
}

/**
 * Token estimator configuration
 */
export interface TokenEstimatorConfig {
  strategy?: TokenEstimationStrategy;
  enableCaching?: boolean;
  maxCacheSize?: number;
  defaultModelFamily?: ModelFamily;
}

/**
 * Main token estimator class
 */
export class TokenEstimator {
  private config: Required<TokenEstimatorConfig>;
  private cache: Map<string, number> = new Map();
  private modelParams: Map<string, ModelTokenParams> = new Map();

  constructor(config: TokenEstimatorConfig = {}) {
    this.config = {
      strategy: config.strategy || TokenEstimationStrategy.HYBRID,
      enableCaching: config.enableCaching ?? true,
      maxCacheSize: config.maxCacheSize || 1000,
      defaultModelFamily: config.defaultModelFamily || ModelFamily.CLAUDE
    };

    this.initializeModelParams();
  }

  /**
   * Initialize model-specific parameters
   */
  private initializeModelParams(): void {
    // Claude models
    this.modelParams.set('claude-3-opus', {
      family: ModelFamily.CLAUDE,
      tokensPerChar: 0.25,      // Claude uses ~4 chars per token on average
      tokensPerWord: 1.3,       // Slightly more efficient than GPT
      specialTokenOverhead: 10,  // System tokens overhead
      codeMultiplier: 1.4,      // Code is more token-dense
      markdownMultiplier: 1.2   // Markdown formatting adds tokens
    });

    this.modelParams.set('claude-3-sonnet', {
      family: ModelFamily.CLAUDE,
      tokensPerChar: 0.25,
      tokensPerWord: 1.3,
      specialTokenOverhead: 10,
      codeMultiplier: 1.4,
      markdownMultiplier: 1.2
    });

    this.modelParams.set('claude-3-haiku', {
      family: ModelFamily.CLAUDE,
      tokensPerChar: 0.25,
      tokensPerWord: 1.3,
      specialTokenOverhead: 8,
      codeMultiplier: 1.4,
      markdownMultiplier: 1.2
    });

    this.modelParams.set('claude-2.1', {
      family: ModelFamily.CLAUDE,
      tokensPerChar: 0.27,      // Slightly less efficient than Claude 3
      tokensPerWord: 1.35,
      specialTokenOverhead: 12,
      codeMultiplier: 1.5,
      markdownMultiplier: 1.25
    });

    // GPT models
    this.modelParams.set('gpt-4', {
      family: ModelFamily.GPT,
      tokensPerChar: 0.25,      // GPT-4 uses cl100k_base encoding
      tokensPerWord: 1.35,
      specialTokenOverhead: 15,
      codeMultiplier: 1.5,
      markdownMultiplier: 1.25
    });

    this.modelParams.set('gpt-3.5-turbo', {
      family: ModelFamily.GPT,
      tokensPerChar: 0.27,
      tokensPerWord: 1.4,
      specialTokenOverhead: 12,
      codeMultiplier: 1.6,
      markdownMultiplier: 1.3
    });

    // Llama models
    this.modelParams.set('llama-2-70b', {
      family: ModelFamily.LLAMA,
      tokensPerChar: 0.3,
      tokensPerWord: 1.5,
      specialTokenOverhead: 10,
      codeMultiplier: 1.7,
      markdownMultiplier: 1.3
    });

    // Default parameters for unknown models
    this.modelParams.set('default', {
      family: ModelFamily.OTHER,
      tokensPerChar: 0.28,
      tokensPerWord: 1.4,
      specialTokenOverhead: 10,
      codeMultiplier: 1.5,
      markdownMultiplier: 1.25
    });
  }

  /**
   * Estimate tokens for a given text
   */
  estimateTokens(
    text: string,
    model: string = 'claude-3-sonnet',
    contentType: ContentType = ContentType.TEXT
  ): number {
    if (!text) return 0;

    // Check cache first
    const cacheKey = this.getCacheKey(text, model, contentType);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let tokens: number;

    switch (this.config.strategy) {
      case TokenEstimationStrategy.SIMPLE:
        tokens = this.simpleEstimation(text, model, contentType);
        break;
      case TokenEstimationStrategy.CLAUDE:
        tokens = this.claudeEstimation(text, model, contentType);
        break;
      case TokenEstimationStrategy.UNICODE:
        tokens = this.unicodeEstimation(text, model, contentType);
        break;
      case TokenEstimationStrategy.HYBRID:
        tokens = this.hybridEstimation(text, model, contentType);
        break;
      default:
        tokens = this.simpleEstimation(text, model, contentType);
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.addToCache(cacheKey, tokens);
    }

    return Math.ceil(tokens);
  }

  /**
   * Simple character and word-based estimation
   */
  private simpleEstimation(text: string, model: string, contentType: ContentType): number {
    const params = this.getModelParams(model);
    
    // Count characters and words
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    
    // Use average of character and word-based estimates
    let baseTokens = (charCount * params.tokensPerChar + wordCount * params.tokensPerWord) / 2;
    
    // Apply content type multipliers
    baseTokens = this.applyContentTypeMultiplier(baseTokens, contentType, params);
    
    // Add special token overhead
    return baseTokens + params.specialTokenOverhead;
  }

  /**
   * Claude-specific token estimation
   */
  private claudeEstimation(text: string, model: string, contentType: ContentType): number {
    const params = this.getModelParams(model);
    
    // Claude-specific tokenization patterns
    let tokens = 0;
    
    // Handle special Claude tokens
    const claudePatterns = [
      { pattern: /\b\w+\b/g, tokensPerMatch: 1 },                    // Words
      { pattern: /[^\w\s]+/g, tokensPerMatch: 1 },                   // Punctuation
      { pattern: /\s+/g, tokensPerMatch: 0.25 },                     // Whitespace
      { pattern: /\n+/g, tokensPerMatch: 1 },                        // Newlines
      { pattern: /```[\s\S]*?```/g, tokensPerMatch: 1.5 },          // Code blocks
      { pattern: /`[^`]+`/g, tokensPerMatch: 1.2 },                 // Inline code
      { pattern: /https?:\/\/\S+/g, tokensPerMatch: 3 },            // URLs
      { pattern: /\b\d+\b/g, tokensPerMatch: 1 },                   // Numbers
      { pattern: /[^\x00-\x7F]+/g, tokensPerMatch: 2 }              // Non-ASCII
    ];
    
    // Count matches for each pattern
    for (const { pattern, tokensPerMatch } of claudePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        tokens += matches.length * tokensPerMatch;
      }
    }
    
    // Apply content type adjustments
    tokens = this.applyContentTypeMultiplier(tokens, contentType, params);
    
    // Add overhead
    return tokens + params.specialTokenOverhead;
  }

  /**
   * Unicode-aware token estimation
   */
  private unicodeEstimation(text: string, model: string, contentType: ContentType): number {
    const params = this.getModelParams(model);
    
    let tokens = 0;
    
    // Analyze Unicode categories
    for (const char of text) {
      const code = char.charCodeAt(0);
      
      if (code < 128) {
        // ASCII characters
        tokens += 0.25;
      } else if (code < 2048) {
        // 2-byte UTF-8
        tokens += 0.5;
      } else if (code < 65536) {
        // 3-byte UTF-8
        tokens += 1;
      } else {
        // 4-byte UTF-8 (including emojis)
        tokens += 2;
      }
    }
    
    // Apply content type multipliers
    tokens = this.applyContentTypeMultiplier(tokens, contentType, params);
    
    return tokens + params.specialTokenOverhead;
  }

  /**
   * Hybrid estimation combining multiple strategies
   */
  private hybridEstimation(text: string, model: string, contentType: ContentType): number {
    // Get estimates from different strategies
    const simple = this.simpleEstimation(text, model, contentType);
    const claude = this.claudeEstimation(text, model, contentType);
    const unicode = this.unicodeEstimation(text, model, contentType);
    
    // Weight the estimates based on model family
    const params = this.getModelParams(model);
    let weighted: number;
    
    switch (params.family) {
      case ModelFamily.CLAUDE:
        // Prefer Claude-specific estimation
        weighted = claude * 0.6 + simple * 0.2 + unicode * 0.2;
        break;
      case ModelFamily.GPT:
        // Balance between simple and unicode
        weighted = simple * 0.5 + unicode * 0.5;
        break;
      default:
        // Equal weighting for unknown models
        weighted = (simple + claude + unicode) / 3;
    }
    
    return weighted;
  }

  /**
   * Apply content type multipliers
   */
  private applyContentTypeMultiplier(
    baseTokens: number,
    contentType: ContentType,
    params: ModelTokenParams
  ): number {
    switch (contentType) {
      case ContentType.CODE:
        return baseTokens * params.codeMultiplier;
      case ContentType.MARKDOWN:
        return baseTokens * params.markdownMultiplier;
      case ContentType.JSON:
        return baseTokens * params.codeMultiplier * 0.9; // JSON is slightly more efficient
      case ContentType.MIXED:
        return baseTokens * ((params.codeMultiplier + params.markdownMultiplier) / 2);
      default:
        return baseTokens;
    }
  }

  /**
   * Detect content type automatically
   */
  detectContentType(text: string): ContentType {
    const codeIndicators = /```|function|class|const|let|var|import|export|if\s*\(|for\s*\(/g;
    const markdownIndicators = /^#{1,6}\s|^\*\s|^\-\s|^\d+\.\s|\[.*\]\(.*\)/gm;
    const jsonIndicators = /^\s*[\{\[]|[\}\]]\s*$/;
    
    const codeMatches = (text.match(codeIndicators) || []).length;
    const markdownMatches = (text.match(markdownIndicators) || []).length;
    const jsonMatch = jsonIndicators.test(text);
    
    if (jsonMatch && this.isValidJson(text)) {
      return ContentType.JSON;
    } else if (codeMatches > 5) {
      return ContentType.CODE;
    } else if (markdownMatches > 3) {
      return ContentType.MARKDOWN;
    } else if (codeMatches > 0 || markdownMatches > 0) {
      return ContentType.MIXED;
    }
    
    return ContentType.TEXT;
  }

  /**
   * Estimate tokens for a conversation (multiple messages)
   */
  estimateConversationTokens(
    messages: Array<{ role: string; content: string }>,
    model: string = 'claude-3-sonnet'
  ): TokenUsage {
    let inputTokens = 0;
    let outputTokens = 0;
    
    for (const message of messages) {
      const contentType = this.detectContentType(message.content);
      const tokens = this.estimateTokens(message.content, model, contentType);
      
      // Assume user/system messages are input, assistant messages are output
      if (message.role === 'assistant') {
        outputTokens += tokens;
      } else {
        inputTokens += tokens;
      }
      
      // Add role token overhead (usually 2-3 tokens per message)
      inputTokens += 3;
    }
    
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }

  /**
   * Calculate cost based on token usage
   */
  calculateCost(
    tokens: TokenUsage,
    model: string = 'claude-3-sonnet'
  ): number {
    // Import rates from CostCalculator or define inline
    const rates: Record<string, { input: number; output: number }> = {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'llama-2-70b': { input: 0.0007, output: 0.0009 }
    };
    
    const rate = rates[model] || { input: 0, output: 0 };
    return (tokens.input * rate.input + tokens.output * rate.output) / 1000;
  }

  /**
   * Get model parameters
   */
  private getModelParams(model: string): ModelTokenParams {
    return this.modelParams.get(model) || this.modelParams.get('default')!;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(text: string, model: string, contentType: ContentType): string {
    // Use first 100 chars + length for cache key to avoid storing full text
    const preview = text.substring(0, 100);
    return `${model}:${contentType}:${preview}:${text.length}`;
  }

  /**
   * Add to cache with size management
   */
  private addToCache(key: string, value: number): void {
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry (first in map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Check if string is valid JSON
   */
  private isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Export token estimation metrics
   */
  exportMetrics(): Record<string, any> {
    return {
      strategy: this.config.strategy,
      cacheEnabled: this.config.enableCaching,
      cacheSize: this.cache.size,
      supportedModels: Array.from(this.modelParams.keys())
    };
  }
}

/**
 * Singleton instance for easy import
 */
export const tokenEstimator = new TokenEstimator({
  strategy: TokenEstimationStrategy.HYBRID,
  enableCaching: true,
  maxCacheSize: 1000
});

/**
 * Utility functions for quick estimation
 */
export function estimateTokens(text: string, model?: string): number {
  return tokenEstimator.estimateTokens(text, model);
}

export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  model?: string
): TokenUsage {
  return tokenEstimator.estimateConversationTokens(messages, model);
}

export function calculateTokenCost(tokens: TokenUsage, model?: string): number {
  return tokenEstimator.calculateCost(tokens, model);
}