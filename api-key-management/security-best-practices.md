# API Key Security Best Practices Research Report

## Executive Summary
This document compiles comprehensive research on API key security best practices based on industry standards from OWASP, NIST, and current 2024 security frameworks. The findings cover key rotation strategies, encryption methods, access control patterns, audit logging requirements, and zero-trust security principles.

## 1. Key Rotation Strategies

### Rotation Intervals
- **Standard Practice**: Rotate API keys every 30-90 days
- **Compliance**: ISO 27001 requires regular key rotation
- **Emergency**: Immediate rotation if compromise is suspected
- **Automation**: Implement automated rotation processes before they're needed

### NIST SP 800-57 Guidelines
- Rotate keys based on cryptoperiod expiration
- Immediate rotation if key is known/suspected to be compromised
- Rotation required when someone with key access leaves the organization
- User credentials excluded from regular rotation (only on compromise)

### Implementation Best Practices
- Set expiration dates for all API keys
- Automate renewal processes using secrets management tools
- Delete unused or unneeded API keys
- Maintain key rotation capabilities in code before needed

## 2. Encryption Methods for Key Storage

### Encryption Standards
- **Data at Rest**: AES-256 encryption (FIPS 140-2 compliant)
- **Data in Transit**: TLS 1.3 or higher
- **Algorithm**: AES-GCM with 256-bit keys or XChaCha20

### Hardware Security Module (HSM) Protection
- **FIPS 140-3 Level 3**: Recommended for highest security
- **FIPS 140-2 Level 2**: Acceptable for standard applications
- **Managed HSMs**: Single-tenant instances with isolated security domains
- **Key Protection**: Hardware-backed cryptographic operations

### Vault Storage Solutions
- **Recommended Tools**:
  - HashiCorp Vault
  - AWS Secrets Manager
  - Azure Key Vault
  - Google Cloud Secret Manager

### Advanced Security Features
- **Double Encryption**: Service-level + infrastructure-level encryption
- **Envelope Encryption**: Using HSMs for key wrapping
- **Perfect Forward Secrecy**: Separate keys across environments
- **Key Generation**: Use CSPRNG for secure key generation

## 3. Access Control Patterns

### Zero Trust Principles
1. **Never Trust, Always Verify**: No implicit trust based on network location
2. **Identity-First Approach**: Establish identity before granting access
3. **Continuous Verification**: Dynamic risk assessment throughout sessions
4. **Least Privilege**: Minimum permissions for minimum time

### Implementation Patterns

#### Just-in-Time (JIT) Access
- Grant privileges only when needed
- Temporary access tokens with short lifespans
- Automatic privilege revocation after task completion

#### Mutual Authentication (mTLS)
- Two-way certificate verification
- Both client and server authenticate each other
- Digital certificates for service-to-service communication

#### Granular Permission Management
- **RBAC** (Role-Based Access Control): For static role assignments
- **ABAC** (Attribute-Based Access Control): For dynamic, context-aware policies
- **Cryptographically Bound Access**: Permissions tied to specific credentials

### Machine Identity Management
- Public Key Infrastructure (PKI) for digital certificates
- Certificate Lifecycle Management (CLM) automation
- Short-lived, role-specific certificates
- Automated discovery, issuance, renewal, and revocation

## 4. Audit Logging Requirements

### Essential Log Components
1. **Actor**: User ID or system ID performing the action
2. **Action Type**: Event name (e.g., key_created, key_rotated, key_deleted)
3. **Timestamp**: UTC timestamp for consistency
4. **Group/Organization**: Permission group or domain
5. **Access Method**: Type of credentials used
6. **Location**: Physical or virtual location of the actor

### API Key Lifecycle Tracking
- Key creation events with creator identity
- Key update/modification events
- Key rotation events with old/new key mapping
- Key deletion events with reason
- Key usage events with frequency metrics

### Immutability Requirements
- **WORM Storage**: Write-Once-Read-Many systems
- **Digital Signatures**: Cryptographic proof of integrity
- **Hash Chains**: Detect unauthorized modifications
- **Blockchain**: For critical audit trails

### SIEM Integration
- **Supported Platforms**:
  - IBM QRadar
  - ArcSight
  - Splunk (with dedicated app)
  - LogRhythm
  - FireEye Helix
  
- **Features**:
  - Real-time monitoring and alerting
  - Automated baseline establishment
  - Anomaly detection
  - Compliance-ready reporting

### Compliance Requirements
- **HIPAA**: 6-year minimum retention
- **GDPR**: Log all personal data access/processing
- **PCI DSS**: Daily log review, 1-year retention
- **SOX**: 7-year retention for financial systems
- **State Laws**: May require longer retention periods

### Log Formats
- **Standardized Formats**:
  - Common Event Format (CEF)
  - Log Event Extended Format (LEEF)
  - Syslog RFC 5424
  - JSON structured logging

## 5. Zero-Trust Security Principles

### Core Concepts
1. **Continuous Authentication**: Verify identity at every interaction
2. **Micro-segmentation**: Limit lateral movement
3. **Adaptive Controls**: Adjust security based on risk signals
4. **Behavior Analytics**: Monitor for anomalous patterns

### Implementation Strategy
1. **Establish Strong Identity**:
   - Multi-factor authentication (MFA)
   - Certificate-based authentication
   - Biometric verification where appropriate

2. **Implement Dynamic Policies**:
   - Context-aware access decisions
   - Risk-based authentication levels
   - Adaptive session management

3. **Monitor Everything**:
   - API call patterns and frequency
   - Geographic anomalies
   - Time-based access patterns
   - Resource consumption metrics

4. **Automate Response**:
   - Automatic key rotation on anomaly detection
   - Dynamic permission adjustment
   - Automated incident response workflows

## 6. Implementation Checklist

### Initial Setup
- [ ] Choose encryption method (AES-256 minimum)
- [ ] Select key management solution (vault)
- [ ] Implement HSM for critical keys
- [ ] Design rotation schedule (30-90 days)
- [ ] Set up SIEM integration

### Access Control
- [ ] Implement identity verification
- [ ] Configure RBAC/ABAC policies
- [ ] Enable JIT access mechanisms
- [ ] Set up mTLS for service communication
- [ ] Configure least privilege defaults

### Monitoring & Compliance
- [ ] Enable comprehensive audit logging
- [ ] Ensure log immutability
- [ ] Set retention policies per compliance
- [ ] Configure real-time alerts
- [ ] Schedule regular security reviews

### Operational Procedures
- [ ] Document rotation procedures
- [ ] Create incident response plan
- [ ] Train team on security practices
- [ ] Regular security audits
- [ ] Penetration testing schedule

## 7. Security Anti-Patterns to Avoid

1. **Never** hard-code API keys in source code
2. **Never** store keys in version control
3. **Never** use plaintext storage for keys
4. **Never** share keys across environments
5. **Never** use permanent API keys for temporary access
6. **Never** skip audit logging for convenience
7. **Never** delay key rotation after compromise

## 8. Recommended Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│  API Gateway    │────▶│   Key Vault     │
│                 │◀────│  (mTLS/Auth)    │◀────│   (HSM-backed)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Audit Logger   │     │  SIEM Platform  │     │  Monitoring     │
│  (Immutable)    │────▶│  (Real-time)    │────▶│  (Alerting)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Conclusion

Implementing these API key security best practices requires a comprehensive approach combining strong encryption, strict access controls, continuous monitoring, and compliance-focused audit logging. The zero-trust model should guide all architectural decisions, ensuring that security is built-in rather than bolted-on.

Regular reviews and updates of these practices are essential as threat landscapes evolve and new standards emerge.