# Cloudflare Workers + D1 Architecture Patterns

## Overview

D1 is Cloudflare's managed, serverless database with SQLite's SQL semantics, designed for horizontal scale-out across multiple, smaller (10 GB) databases such as per-user, per-tenant, or per-entity databases.

## Core Architecture Patterns

### 1. Horizontal Scaling Pattern

**Concept**: D1 enables building applications with thousands of databases at no extra cost for data isolation.

**Implementation**:
- Create per-user, per-tenant, or per-entity databases
- Distribute data across multiple smaller databases (max 10GB each)
- Leverage cost model that charges only for queries and storage

**Use Cases**:
- Multi-tenant SaaS applications
- User-isolated data stores
- Geographic data partitioning

### 2. Global Distribution with Read Replicas

**Architecture**: Asynchronous read replication with eventual consistency.

**Key Features**:
- Read replicas serve as read-only, near-real-time copies
- Primary database handles all writes
- Updates sent asynchronously to replica servers
- Smart Placement optimizes Worker location relative to data

**Performance Considerations**:
- Read replicas may lag behind primary database
- Sequential consistency maintained within sessions
- First query in session directed to primary for latest data

### 3. Serverless Integration Pattern

**Components**:
- Application servers (typically Workers)
- Database communication over network
- HTTP API support for external tooling
- Binding-based Worker-to-D1 connections

## Best Practices

### Database Design and Sizing

**Guidelines**:
- Keep individual databases under 10GB
- Design for read-heavy workloads
- Consider horizontal partitioning for larger datasets
- Use D1 for lightweight, globally distributed applications

### Performance Optimization

**Strategies**:
- Leverage Smart Placement for latency reduction
- Colocate Workers with frequently accessed data
- Use D1DatabaseSession for sequential consistency
- Implement proper indexing strategies

### Transaction and Consistency Patterns

**Session Management**:
```javascript
// Start session with primary database access
const session = env.DB.withSession();
// Sequential consistency maintained throughout session
```

**Consistency Levels**:
- Eventual consistency across read replicas
- Sequential consistency within sessions
- Strong consistency on primary database

### Batch Operations

**Pattern**:
```javascript
// Atomic batch operations
const statements = [
  env.DB.prepare("INSERT INTO users (name) VALUES (?)").bind("Alice"),
  env.DB.prepare("INSERT INTO profiles (user_id, bio) VALUES (?, ?)").bind(1, "Developer")
];

const results = await env.DB.batch(statements);
```

**Benefits**:
- Atomic operations across multiple statements
- Reduced network round trips
- Better performance for bulk operations

### Development Workflow

**Tools**:
- Wrangler CLI for database creation and management
- Cloudflare Dashboard UI for visual management
- Real-time schema updates without deployment
- Time Travel for disaster recovery

### Backup and Disaster Recovery

**Features**:
- Automatic snapshotting to R2
- Time Travel capabilities
- Redundancy through Durable Objects
- No manual backup provisioning required

## Use Case Selection

### Ideal For:
- Persistent, relational storage for structured data
- Applications requiring ad-hoc SQL querying
- Read-heavy workloads (most web applications)
- Global user bases needing low latency
- Serverless applications without RDBMS management overhead

### Not Ideal For:
- Strong consistency requirements across global replicas
- Write-heavy workloads
- Single databases larger than 10GB
- Applications requiring immediate consistency

## Integration Patterns

### Worker Binding Pattern
```javascript
export default {
  async fetch(request, env) {
    // Access D1 through binding
    const result = await env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(userId).first();
    
    return new Response(JSON.stringify(result));
  }
};
```

### External API Access
- HTTP API for third-party tooling
- RESTful endpoints for database operations
- Authentication through Cloudflare credentials

## Architecture Decision Framework

### Choose D1 When:
- Application is primarily read-heavy
- Global distribution is required
- Serverless architecture is preferred
- Data can be partitioned into <10GB chunks
- SQL querying capabilities are needed

### Consider Alternatives When:
- Strong consistency is critical
- Write-heavy operations are primary
- Single large database is required
- Real-time analytics on large datasets
- Complex joins across distributed data

## Performance Characteristics

### Latency:
- Sub-10ms read latency from edge locations
- Write latency depends on primary database location
- Smart Placement reduces total request latency

### Throughput:
- Scales with number of databases
- Read replicas increase read capacity
- Batch operations improve write throughput

### Consistency:
- Eventual consistency for reads from replicas
- Strong consistency for primary database operations
- Sequential consistency within sessions