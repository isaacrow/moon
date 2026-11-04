# FOLIO Platform Integration Guide for Moon

## Overview

Moon now includes comprehensive integration with the FOLIO platform, enabling full cataloging capabilities through FOLIO's powerful microservices architecture.

## Features

### 1. **FOLIO Module Browser** (377+ Modules)
- Browse all FOLIO modules by category (UI, Backend, Edge APIs, Stripes, Platforms)
- Search and filter modules
- Direct links to GitHub repos, API docs, and user guides
- Comprehensive module descriptions

### 2. **FOLIO Live Integration**
- Connect to any FOLIO instance (local or hosted)
- Search FOLIO inventory
- Export Moon BIBFRAME records to FOLIO
- Import FOLIO instances to Moon
- Full bidirectional data flow

## Getting Started

### Option 1: Use Public FOLIO Snapshot (No Setup Required)

1. Navigate to **Dashboard → FOLIO Live Integration**
2. Use the pre-configured settings:
   ```
   Okapi URL: https://folio-snapshot-okapi.dev.folio.org
   Tenant: diku
   ```
3. Click **Connect to FOLIO**
4. You're ready to search and integrate!

### Option 2: Set Up Local FOLIO Instance

#### Prerequisites
- Docker and Docker Compose
- 8GB+ RAM
- 20GB+ free disk space

#### Quick Setup with Docker

```bash
# Clone FOLIO platform
git clone https://github.com/folio-org/platform-complete
cd platform-complete

# Start FOLIO with Docker Compose
docker-compose up -d

# Wait for services to start (5-10 minutes)
# Okapi will be available at http://localhost:9130
```

#### Configure Moon to Connect

1. In Moon, go to **FOLIO Live Integration**
2. Enter connection details:
   ```
   Okapi URL: http://localhost:9130
   Tenant: diku
   Username: diku_admin
   Password: admin
   ```
3. Click **Connect to FOLIO**

## FOLIO Modules Used by Moon

### Core Inventory Modules

1. **mod-inventory** 
   - GitHub: https://github.com/folio-org/mod-inventory
   - Business logic for instances, holdings, items
   - Provides REST APIs for cataloging

2. **mod-inventory-storage**
   - GitHub: https://github.com/folio-org/mod-inventory-storage
   - PostgreSQL persistence layer
   - Stores MARC and non-MARC records

3. **mod-source-record-storage**
   - GitHub: https://github.com/folio-org/mod-source-record-storage
   - MARC record storage (SRS)
   - Source record management

4. **mod-data-import**
   - GitHub: https://github.com/folio-org/mod-data-import
   - Batch MARC import
   - File upload and processing

5. **okapi**
   - GitHub: https://github.com/folio-org/okapi
   - API Gateway
   - Service discovery and routing
   - Authentication and authorization

### Framework

6. **raml-module-builder (RMB)**
   - GitHub: https://github.com/folio-org/raml-module-builder
   - Framework for building FOLIO modules
   - RAML-based API generation
   - PostgreSQL integration

## API Endpoints Used

### Authentication
```
POST /authn/login
Headers:
  Content-Type: application/json
  X-Okapi-Tenant: {tenant}
Body:
  {
    "username": "username",
    "password": "password"
  }
Response:
  X-Okapi-Token: {jwt-token}
```

### Instance Management
```
# Search Instances
GET /instance-storage/instances?query={cql}&limit={limit}

# Get Instance by ID
GET /instance-storage/instances/{instanceId}

# Create Instance
POST /instance-storage/instances
Body: {instance object}

# Update Instance
PUT /instance-storage/instances/{instanceId}
Body: {instance object}

# Delete Instance
DELETE /instance-storage/instances/{instanceId}
```

### Holdings Management
```
# Get Holdings for Instance
GET /holdings-storage/holdings?query=instanceId=={instanceId}

# Create Holding
POST /holdings-storage/holdings
Body: {holding object}
```

### Items Management
```
# Get Items for Holding
GET /item-storage/items?query=holdingsRecordId=={holdingsRecordId}

# Create Item
POST /item-storage/items
Body: {item object}
```

### Reference Data
```
GET /instance-types
GET /identifier-types
GET /contributor-name-types
GET /locations
GET /material-types
```

## BIBFRAME to FOLIO Mapping

### Instance Fields

| BIBFRAME Field | FOLIO Field | Notes |
|----------------|-------------|-------|
| `title` | `title` | Main title |
| `contribution[].agent.label` | `contributors[].name` | Contributors |
| `identifiedBy[].value` | `identifiers[].value` | ISBN, ISSN, etc. |
| `subject[].label` | `subjects[].value` | Subject headings |
| `provisionActivity[].agent.label` | `publication[].publisher` | Publisher |
| `provisionActivity[].date` | `publication[].dateOfPublication` | Pub date |
| `@type` | `instanceTypeId` | Mapped to UUID |

### Type Mappings

```typescript
BIBFRAME Type → FOLIO Instance Type ID (UUID)
bf:Text       → 6312d172-f0cf-40f6-b27d-9fa8feaf332f
bf:StillImage → 3363cdb1-e644-446c-82a4-dc3a1d4395b9
bf:MovingImage → 526aa04d-9289-4511-8866-349299592c18
```

## CQL (Contextual Query Language)

FOLIO uses CQL for searching. Examples:

```
# Title search
title="*Shakespeare*"

# Contributor search
contributors="*Smith*"

# Combined search
title="Hamlet" AND contributors="Shakespeare"

# Identifier search
identifiers.value="9780123456789"

# Date range
publication.dateOfPublication>1900 AND publication.dateOfPublication<2000
```

## Development Setup

### Install FOLIO Tools

```bash
# Clone folio-tools
git clone https://github.com/folio-org/folio-tools
cd folio-tools

# API documentation generator
cd api-doc
python3 api_doc.py --help

# API linter
cd ../api-lint
npm install
```

### Generate API Documentation

```bash
# For RAML modules
cd mod-inventory
python3 ../folio-tools/api-doc/api_doc.py \
  -t RAML \
  -d ramls

# For OpenAPI modules
cd mod-search
python3 ../folio-tools/api-doc/api_doc.py \
  -t OAS \
  -d src/main/resources/openapi
```

### Build Custom FOLIO Module

```bash
# Using RAML Module Builder
git clone https://github.com/folio-org/raml-module-builder
cd raml-module-builder

# Create new module from template
mvn archetype:generate \
  -DarchetypeGroupId=org.folio \
  -DarchetypeArtifactId=raml-module-builder-archetype

# Build module
mvn clean install
```

## Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to FOLIO"
- Check Okapi URL is accessible
- Verify tenant ID is correct
- Ensure FOLIO services are running
- Check firewall/network settings

**Problem**: "Authentication failed"
- Verify username and password
- Check user has required permissions
- Ensure user belongs to specified tenant

### Search Issues

**Problem**: "No results found"
- Verify CQL syntax
- Check data exists in FOLIO
- Try simpler query first
- Use wildcard searches: `title="*test*"`

### Import/Export Issues

**Problem**: "Failed to create instance"
- Check required fields are present
- Verify UUIDs for reference data
- Ensure proper instanceTypeId
- Check instance doesn't already exist

## Advanced Configuration

### Custom Reference Data

Get actual UUIDs from your FOLIO instance:

```typescript
// Update folioApiClient.ts mappers
private mapInstanceType(bibframeType: string): string {
  // Get these UUIDs from your FOLIO instance
  const response = await fetch('/instance-types');
  const types = await response.json();
  
  // Map based on actual data
  return types.find(t => t.name === 'text')?.id || defaultId;
}
```

### Batch Operations

```typescript
// Import multiple records
const instances = bibframeRecords.map(bf => 
  client.bibframeToFOLIOInstance(bf)
);

for (const instance of instances) {
  await client.createInstance(instance);
}
```

### Event Integration

```typescript
// Listen to FOLIO events via mod-pubsub
const subscription = {
  eventType: 'INSTANCE_CREATED',
  callback: (event) => {
    console.log('New instance created:', event);
  }
};
```

## Resources

### Official Documentation
- FOLIO Developer: https://dev.folio.org
- API Reference: https://dev.folio.org/reference/api/
- GitHub Organization: https://github.com/folio-org
- FOLIO Wiki: https://wiki.folio.org

### Key Repositories
- Okapi: https://github.com/folio-org/okapi
- RMB: https://github.com/folio-org/raml-module-builder
- mod-inventory: https://github.com/folio-org/mod-inventory
- Stripes: https://github.com/folio-org/stripes
- Platform Complete: https://github.com/folio-org/platform-complete

### Community
- FOLIO Slack: https://folio-project.slack.com
- Discuss: https://discuss.folio.org
- YouTube: https://www.youtube.com/@FOLIOlibrary

## Best Practices

1. **Always authenticate** before making API calls
2. **Use CQL for complex queries** instead of fetching all records
3. **Handle errors gracefully** with proper error messages
4. **Cache reference data** (types, identifiers) to reduce API calls
5. **Validate data** before sending to FOLIO
6. **Use UUIDs** from your FOLIO instance, not hardcoded values
7. **Test with snapshot instance** before production
8. **Monitor API rate limits** and implement throttling
9. **Log all operations** for debugging
10. **Keep FOLIO modules updated** for latest features

## Support

For issues with:
- **Moon Integration**: Open issue in Moon repository
- **FOLIO Platform**: Use FOLIO Slack or Discuss forum
- **Specific Modules**: Open issue in module's GitHub repo

## License

FOLIO Platform: Apache License 2.0
Moon Integration: Same as Moon project license
