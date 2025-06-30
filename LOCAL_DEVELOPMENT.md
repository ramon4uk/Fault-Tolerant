# Local Development Guide

This guide will help you test your serverless application locally without needing an AWS account.

## Prerequisites

- **Node.js** (v18 or higher)
- **Docker** and **Docker Compose**
- **AWS CLI** (for LocalStack setup)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start LocalStack

```bash
# Start LocalStack in the background
docker-compose up -d localstack

# Wait for LocalStack to be ready (check logs)
docker logs -f learn-dlq-localstack
```

### 3. Setup Local Resources

```bash
# Create DynamoDB tables and SQS queues
./setup-local.sh
```

### 4. Start the Application

```bash
# Start the serverless application locally
npm start
```

The application will be available at:
- **API Gateway**: http://localhost:3000
- **LocalStack Dashboard**: http://localhost:4566

### 5. Test the API

```bash
# Run the test script
./test-api.sh

# Or test manually
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"answer":"test answer"}'
```

## Available Scripts

- `npm start` - Start the application locally with Serverless Offline
- `npm run start:localstack` - Start LocalStack and the application
- `npm run stop:localstack` - Stop LocalStack
- `./setup-local.sh` - Setup DynamoDB tables and SQS queues in LocalStack
- `./test-api.sh` - Test all API endpoints

## API Endpoints

### Submit Task
```bash
POST http://localhost:3000/tasks
Content-Type: application/json

{
  "answer": "Your task answer"
}
```

### Get Task Status
```bash
GET http://localhost:3000/tasks?taskId=<task-id>
```

## Testing Features

### 1. Normal Task Processing
Submit a task with any answer:
```bash
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"answer":"normal task"}'
```

### 2. Failure Simulation
The application has a configurable failure rate (30% by default). Some tasks will intentionally fail to test the DLQ functionality.

### 3. Dead Letter Queue Testing
Failed tasks will be moved to the DLQ after 3 retry attempts. You can monitor this in the logs.

## Troubleshooting

### LocalStack Issues
```bash
# Check LocalStack status
curl http://localhost:4566/health

# View LocalStack logs
docker logs learn-dlq-localstack

# Restart LocalStack
docker-compose down && docker-compose up -d localstack
```

### Application Issues
```bash
# Check if dependencies are installed
npm install

# Verify TypeScript compilation
npm run build

# Check serverless offline logs
# (output will show in the terminal where you ran 'npm start')
```

### Resource Issues
```bash
# Re-create resources
./setup-local.sh

# List DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1

# List SQS queues
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1
```

## Development Workflow

1. **Start LocalStack**: `docker-compose up -d localstack`
2. **Setup Resources**: `./setup-local.sh`
3. **Start App**: `npm start`
4. **Make Changes**: Edit your handlers in `src/handlers/`
5. **Test**: Use `./test-api.sh` or manual curl commands
6. **View Logs**: Check the terminal running `npm start`

## Environment Variables

When running locally, the following environment variables are automatically set:

- `TASKS_TABLE`: learn-dlq-tasks-local
- `TASK_QUEUE_URL`: LocalStack SQS queue URL
- `DLQ_URL`: LocalStack DLQ URL
- `MAX_RETRIES`: 2
- `BASE_DELAY_SECONDS`: 2
- `MAX_DELAY_SECONDS`: 900
- `FAILURE_RATE`: 0.3 (30% failure for testing)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Submit Task    │────│   DynamoDB      │
│  (Port 3000)    │    │   Lambda        │    │  (LocalStack)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   SQS Queue     │
                       │  (LocalStack)   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Process Task   │────│      DLQ        │
                       │   Lambda        │    │  (LocalStack)   │
                       └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Monitor DLQ    │
                                              │   Lambda        │
                                              └─────────────────┘
```

## Cleanup

```bash
# Stop the application (Ctrl+C in the terminal running npm start)
# Stop LocalStack
npm run stop:localstack

# Remove Docker volumes (optional)
docker volume prune
``` 