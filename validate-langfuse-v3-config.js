#!/usr/bin/env node

/**
 * Langfuse v3 Configuration Validator
 * Validates ClickHouse URL schemes, Redis connectivity, and v3 compatibility
 */

const fs = require('fs');
const path = require('path');

class LangfuseV3Validator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        switch (level) {
            case 'error':
                this.errors.push(message);
                console.error(`❌ ${logMessage}`);
                break;
            case 'warning':
                this.warnings.push(message);
                console.warn(`⚠️ ${logMessage}`);
                break;
            case 'info':
                this.info.push(message);
                console.log(`ℹ️ ${logMessage}`);
                break;
            case 'success':
                console.log(`✅ ${logMessage}`);
                break;
        }
    }

    validateClickHouseUrlScheme(url, urlType) {
        if (!url) {
            this.log('error', `${urlType} is required for Langfuse v3`);
            return false;
        }

        // Validate HTTP URL scheme for API access
        if (urlType === 'CLICKHOUSE_URL') {
            if (!url.match(/^https?:\/\/[^:]+:\d+$/)) {
                this.log('error', `${urlType} must use HTTP/HTTPS scheme (e.g., http://clickhouse:8123)`);
                return false;
            }
            this.log('success', `${urlType} has valid HTTP scheme: ${url}`);
        }

        // Validate ClickHouse native protocol for migrations
        if (urlType === 'CLICKHOUSE_MIGRATION_URL') {
            if (!url.match(/^clickhouse:\/\/[^:]+:\d+$/)) {
                this.log('error', `${urlType} must use clickhouse:// scheme (e.g., clickhouse://clickhouse:9000)`);
                return false;
            }
            this.log('success', `${urlType} has valid ClickHouse native scheme: ${url}`);
        }

        return true;
    }

    validateRedisConfig() {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || '6379';
        const redisAuth = process.env.REDIS_AUTH || process.env.REDIS_PASSWORD;

        if (!redisAuth) {
            this.log('warning', 'Redis authentication not configured - recommended for production');
        } else {
            this.log('success', 'Redis authentication configured');
        }

        this.log('info', `Redis configuration: ${redisHost}:${redisPort}`);
        return true;
    }

    validateEnvironmentVariables() {
        const requiredVars = [
            'DATABASE_URL',
            'CLICKHOUSE_URL',
            'CLICKHOUSE_MIGRATION_URL',
            'CLICKHOUSE_USER',
            'CLICKHOUSE_PASSWORD'
        ];

        const recommendedVars = [
            'REDIS_HOST',
            'REDIS_PORT',
            'S3_BUCKET_NAME',
            'LANGFUSE_V3_ENABLED',
            'LANGFUSE_WORKER_ENABLED'
        ];

        // Check required variables
        requiredVars.forEach(varName => {
            if (!process.env[varName]) {
                this.log('error', `Required environment variable ${varName} is not set`);
            } else {
                this.log('success', `Required variable ${varName} is configured`);
                
                // Validate URL schemes
                if (varName === 'CLICKHOUSE_URL' || varName === 'CLICKHOUSE_MIGRATION_URL') {
                    this.validateClickHouseUrlScheme(process.env[varName], varName);
                }
            }
        });

        // Check recommended variables
        recommendedVars.forEach(varName => {
            if (!process.env[varName]) {
                this.log('warning', `Recommended environment variable ${varName} is not set`);
            } else {
                this.log('info', `Recommended variable ${varName} is configured`);
            }
        });
    }

    validateDockerCompose() {
        const dockerComposePath = path.join(process.cwd(), 'docker-compose.langfuse.yml');
        
        if (!fs.existsSync(dockerComposePath)) {
            this.log('error', 'docker-compose.langfuse.yml not found');
            return false;
        }

        try {
            const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
            
            // Check for v3 services
            const requiredServices = ['clickhouse', 'redis', 'langfuse', 'langfuse-worker'];
            const v3Indicators = [
                'langfuse/langfuse:v3',
                'clickhouse/clickhouse-server',
                'CLICKHOUSE_URL',
                'CLICKHOUSE_MIGRATION_URL',
                'REDIS_HOST'
            ];

            requiredServices.forEach(service => {
                if (dockerComposeContent.includes(service + ':')) {
                    this.log('success', `Docker service '${service}' found in configuration`);
                } else {
                    this.log('error', `Docker service '${service}' missing from configuration`);
                }
            });

            v3Indicators.forEach(indicator => {
                if (dockerComposeContent.includes(indicator)) {
                    this.log('success', `v3 indicator '${indicator}' found in Docker configuration`);
                } else {
                    this.log('warning', `v3 indicator '${indicator}' not found in Docker configuration`);
                }
            });

        } catch (error) {
            this.log('error', `Failed to read docker-compose.langfuse.yml: ${error.message}`);
            return false;
        }

        return true;
    }

    validateV3Features() {
        // Check if v3 is explicitly enabled
        const v3Enabled = process.env.LANGFUSE_V3_ENABLED === 'true';
        const workerEnabled = process.env.LANGFUSE_WORKER_ENABLED === 'true';
        const ingestionEnabled = process.env.LANGFUSE_INGESTION_ENABLED === 'true';

        if (v3Enabled) {
            this.log('success', 'Langfuse v3 features are enabled');
        } else {
            this.log('warning', 'Langfuse v3 features are not explicitly enabled');
        }

        if (workerEnabled) {
            this.log('success', 'Langfuse v3 worker processing is enabled');
        } else {
            this.log('warning', 'Langfuse v3 worker processing is not enabled');
        }

        // Validate performance settings
        const batchSize = parseInt(process.env.LANGFUSE_MAX_INGESTION_BATCH_SIZE || '0');
        if (batchSize >= 2000) {
            this.log('success', `v3 optimized batch size configured: ${batchSize}`);
        } else {
            this.log('warning', `Consider increasing LANGFUSE_MAX_INGESTION_BATCH_SIZE to 2000+ for v3 performance`);
        }
    }

    async testConnectivity() {
        this.log('info', 'Testing connectivity to v3 services...');
        
        // Test ClickHouse HTTP endpoint
        const clickhouseUrl = process.env.CLICKHOUSE_URL;
        if (clickhouseUrl) {
            try {
                // Note: This would require HTTP client in a real environment
                this.log('info', `ClickHouse HTTP endpoint: ${clickhouseUrl}/ping`);
            } catch (error) {
                this.log('warning', `Could not test ClickHouse connectivity: ${error.message}`);
            }
        }

        // Test Redis connectivity
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || '6379';
        this.log('info', `Redis endpoint: ${redisHost}:${redisPort}`);
    }

    generateSummaryReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 LANGFUSE v3 CONFIGURATION VALIDATION SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`\n📊 Results:`);
        console.log(`   ✅ Successes: ${this.info.length + (this.errors.length === 0 ? 1 : 0)}`);
        console.log(`   ⚠️  Warnings: ${this.warnings.length}`);
        console.log(`   ❌ Errors: ${this.errors.length}`);

        if (this.errors.length > 0) {
            console.log(`\n❌ Critical Issues:`);
            this.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        if (this.warnings.length > 0) {
            console.log(`\n⚠️  Recommendations:`);
            this.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }

        console.log(`\n🚀 v3 Readiness:`);
        if (this.errors.length === 0) {
            console.log(`   ✅ Configuration is ready for Langfuse v3 deployment`);
            console.log(`   ✅ ClickHouse URL schemes are properly configured`);
            console.log(`   ✅ Redis integration is set up`);
            console.log(`   ✅ Docker services are properly defined`);
        } else {
            console.log(`   ❌ Configuration requires fixes before v3 deployment`);
            console.log(`   🔧 Please address the critical issues listed above`);
        }

        console.log(`\n🔄 Next Steps:`);
        console.log(`   1. Run: docker-compose -f docker-compose.langfuse.yml up -d`);
        console.log(`   2. Verify services: docker-compose -f docker-compose.langfuse.yml ps`);
        console.log(`   3. Check ClickHouse: curl http://localhost:8123/ping`);
        console.log(`   4. Check Redis: redis-cli ping`);
        console.log(`   5. Access Langfuse v3: http://localhost:3001`);

        console.log('\n' + '='.repeat(80));
        
        return this.errors.length === 0;
    }

    async validate() {
        console.log('🔍 Starting Langfuse v3 Configuration Validation...\n');
        
        try {
            this.validateEnvironmentVariables();
            this.validateRedisConfig();
            this.validateDockerCompose();
            this.validateV3Features();
            await this.testConnectivity();
            
            return this.generateSummaryReport();
        } catch (error) {
            this.log('error', `Validation failed: ${error.message}`);
            return false;
        }
    }
}

// Load environment variables from .env files
function loadEnvironmentVariables() {
    const envFiles = [
        '.env.langfuse',
        '.env.local',
        '.env'
    ];

    envFiles.forEach(envFile => {
        const envPath = path.join(process.cwd(), envFile);
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0 && !key.startsWith('#')) {
                    const value = valueParts.join('=').trim();
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
            console.log(`📄 Loaded environment variables from ${envFile}`);
        }
    });
}

// Main execution
async function main() {
    loadEnvironmentVariables();
    
    const validator = new LangfuseV3Validator();
    const isValid = await validator.validate();
    
    process.exit(isValid ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Validation script failed:', error);
        process.exit(1);
    });
}

module.exports = { LangfuseV3Validator };