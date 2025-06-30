# Learn DLQ - Task Processing with Dead Letter Queue

A Node.js backend built with AWS services that demonstrates task processing with exponential backoff retry strategy and Dead Letter Queue (DLQ) monitoring.

## Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    Client[Client Application] --> AG[API Gateway]
    
    subgraph "API Layer"
        AG --> L1[Submit Task Lambda]
        AG --> L2[Get Status Lambda]
    end
    
    subgraph "Processing Layer"
        L1 --> SQS1[Task Queue]
        SQS1 --> L3[Process Task Lambda]
        L3 --> SQS1
        SQS1 --> DLQ[Dead Letter Queue]
        DLQ --> L4[DLQ Monitor Lambda]
    end
    
    subgraph "Storage Layer"
        L1 --> DB[(DynamoDB<br/>Tasks Table)]
        L2 --> DB
        L3 --> DB
        L4 --> DB
    end
    
    subgraph "Monitoring"
        L4 --> CW[CloudWatch Logs]
        L3 --> CW
        L1 --> CW
        L2 --> CW
    end
    
    classDef lambda fill:#ff9900,stroke:#232f3e,stroke-width:2px,color:#fff
    classDef storage fill:#3f48cc,stroke:#232f3e,stroke-width:2px,color:#fff
    classDef queue fill:#ff4b4b,stroke:#232f3e,stroke-width:2px,color:#fff
    classDef api fill:#232f3e,stroke:#ff9900,stroke-width:2px,color:#fff
    classDef monitoring fill:#146eb4,stroke:#232f3e,stroke-width:2px,color:#fff
    
    class L1,L2,L3,L4 lambda
    class DB storage
    class SQS1,DLQ queue
    class AG api
    class CW monitoring
```

### Component Overview

- **API Gateway + Lambda**: RESTful API for task submission and status retrieval
- **SQS**: Asynchronous task processing queue with retry mechanism
- **DLQ**: Dead Letter Queue for failed tasks after max retries
- **DynamoDB**: Task state storage with full lifecycle tracking
- **Lambda Functions**: Distributed processing and monitoring
- **CloudWatch**: Centralized logging and monitoring

## Features

- ✅ Task submission via REST API
- ✅ Asynchronous task processing
- ✅ Exponential backoff retry strategy (max 2 retries)
- ✅ Dead Letter Queue for unprocessable tasks
- ✅ DLQ monitoring with CloudWatch logging
- ✅ Task state tracking in DynamoDB
- ✅ 30% random failure simulation
- ✅ TypeScript implementation
- ✅ Serverless Framework deployment

## Project Structure

```
src/
├── handlers/           # Lambda function handlers
│   ├── submitTask.ts   # POST /tasks - Submit new task
│   ├── getTaskStatus.ts # GET /tasks - Get all task statuses
│   ├── processTask.ts  # SQS processor with retry logic
│   └── monitorDLQ.ts   # DLQ monitoring and logging
├── services/           # AWS service clients
│   ├── dynamodb.ts     # DynamoDB operations
│   └── sqs.ts          # SQS operations
├── types/              # TypeScript type definitions
│   └── index.ts        # Task and API types
└── utils/              # Utility functions
    └── backoff.ts      # Exponential backoff calculation
```

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate permissions
- Serverless Framework CLI

## Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure AWS credentials:
```bash
aws configure
```

## Deployment

Deploy to AWS:
```bash
# Deploy to dev stage (default)
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Remove deployment
npm run remove
```

## API Endpoints

After deployment, you'll get API Gateway endpoints:

### Submit Task
```bash
POST https://your-api-id.execute-api.region.amazonaws.com/dev/tasks
Content-Type: application/json

{
  "answer": "Your task answer here"
}
```

Response:
```json
{
  "taskId": "uuid-here",
  "status": "PENDING",
  "message": "Task submitted successfully"
}
```

### Get Task Status
```bash
GET https://your-api-id.execute-api.region.amazonaws.com/dev/tasks
```

Response:
```json
{
  "tasks": [
    {
      "taskId": "uuid-here",
      "answer": "task answer",
      "status": "COMPLETED|FAILED|PENDING|PROCESSING|DLQ",
      "retries": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "errorMessage": "Error details if failed"
    }
  ]
}
```

## Task Processing Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant AG as API Gateway
    participant SL as Submit Lambda
    participant DB as DynamoDB
    participant SQS as Task Queue
    participant PL as Process Lambda
    participant DLQ as Dead Letter Queue
    participant ML as Monitor Lambda
    participant CW as CloudWatch

    C->>AG: POST /tasks {"answer": "data"}
    AG->>SL: Invoke
    SL->>DB: Create task record (PENDING)
    SL->>SQS: Send message
    SL->>AG: Return taskId & status
    AG->>C: Response

    SQS->>PL: Trigger (attempt 1)
    PL->>DB: Update status (PROCESSING)
    
    alt Task Success (70%)
        PL->>DB: Update status (COMPLETED)
    else Task Failure (30%)
        PL->>DB: Increment retry count
        alt Retry Available
            PL->>SQS: Send with delay (exp backoff)
            PL->>DB: Update status (PENDING)
            SQS->>PL: Trigger (attempt 2)
        else Max Retries Exceeded
            PL->>DB: Update status (DLQ)
            SQS->>DLQ: Auto-route message
            DLQ->>ML: Trigger monitoring
            ML->>CW: Log DLQ event
            ML->>DB: Update final status
        end
    end

    C->>AG: GET /tasks
    AG->>SL: Invoke Status Lambda
    SL->>DB: Query all tasks
    SL->>AG: Return tasks array
    AG->>C: Task statuses
```

### Processing Steps

1. **Task Submission**: Task submitted via POST /tasks
2. **Queue Processing**: Task sent to SQS queue
3. **Processing**: Lambda processes task (70% success, 30% failure simulation)
4. **Retry Logic**: Failed tasks retry with exponential backoff
5. **DLQ Routing**: Tasks exceeding max retries (2) sent to DLQ
6. **DLQ Monitoring**: DLQ Lambda logs failed task details to CloudWatch

## Retry Strategy

- **Max Retries**: 2 (configurable in serverless.yml)
- **Backoff Formula**: `min(2^retryCount * 2 seconds, 15 minutes)`
- **Retry Delays**: 
  - 1st retry: 2 seconds
  - 2nd retry: 4 seconds
  - After 2 failures: Sent to DLQ

## Task States

- `PENDING`: Task queued for processing
- `PROCESSING`: Task currently being processed
- `COMPLETED`: Task completed successfully
- `FAILED`: Task failed but will retry
- `DLQ`: Task sent to Dead Letter Queue after max retries

## Monitoring

### CloudWatch Logs
- Check Lambda function logs for processing details
- DLQ monitor logs structured JSON for easy querying

### CloudWatch Insights Queries
Query DLQ messages:
```sql
fields @timestamp, taskId, errorMessage, retryCount
| filter eventType = "DLQ_MESSAGE"
| sort @timestamp desc
```

### AWS Console
- **SQS**: Monitor queue depths and message flow
- **DynamoDB**: View task records and status
- **Lambda**: Function metrics and logs

## Configuration

Key configuration in `serverless.yml`:
- **maxReceiveCount**: 3 (initial + 2 retries)
- **visibilityTimeout**: 300 seconds
- **messageRetentionPeriod**: 14 days

## Development

Build TypeScript:
```bash
npm run build
```

View deployment info:
```bash
npm run info
```

View function logs:
```bash
npm run logs -- -f processTask -t
```

## Testing

Test with curl:
```bash
# Submit a task
curl -X POST https://your-api-id.execute-api.region.amazonaws.com/dev/tasks \
  -H "Content-Type: application/json" \
  -d '{"answer": "test answer"}'

# Check task status
curl https://your-api-id.execute-api.region.amazonaws.com/dev/tasks
```

## Cleanup

Remove all AWS resources:
```bash
npm run remove
```

## Cost Optimization

- DynamoDB: Pay-per-request billing
- Lambda: Pay-per-invocation
- SQS: Pay-per-request
- API Gateway: Pay-per-request

Estimated cost for development/testing: $1-5/month