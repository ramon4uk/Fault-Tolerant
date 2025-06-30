#!/bin/bash

# Setup script for local development with LocalStack
echo "🚀 Setting up LocalStack resources for learn-dlq..."

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
while ! curl -s http://localhost:4566/health > /dev/null; do
  sleep 2
done
echo "✅ LocalStack is ready!"

# Create DynamoDB table
echo "📦 Creating DynamoDB table..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name learn-dlq-tasks-local \
  --attribute-definitions AttributeName=taskId,AttributeType=S \
  --key-schema AttributeName=taskId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Create SQS queues
echo "📬 Creating SQS queues..."

# Create main task queue
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name learn-dlq-task-queue-local \
  --region us-east-1

# Create dead letter queue
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name learn-dlq-task-dlq-local \
  --region us-east-1

# Get queue URLs
TASK_QUEUE_URL=$(aws --endpoint-url=http://localhost:4566 sqs get-queue-url --queue-name learn-dlq-task-queue-local --region us-east-1 --output text --query 'QueueUrl')
DLQ_URL=$(aws --endpoint-url=http://localhost:4566 sqs get-queue-url --queue-name learn-dlq-task-dlq-local --region us-east-1 --output text --query 'QueueUrl')

echo "📋 Task Queue URL: $TASK_QUEUE_URL"
echo "💀 DLQ URL: $DLQ_URL"

# Configure redrive policy for main queue
echo "🔄 Configuring redrive policy..."
aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes \
  --queue-url $TASK_QUEUE_URL \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"arn:aws:sqs:us-east-1:000000000000:learn-dlq-task-dlq-local\\\",\\\"maxReceiveCount\\\":3}\"}" \
  --region us-east-1

echo "✅ Local setup complete!"
echo ""
echo "🎯 You can now test your application:"
echo "   1. API Endpoints will be available at: http://localhost:3000"
echo "   2. LocalStack Dashboard: http://localhost:4566"
echo "   3. DynamoDB Admin: http://localhost:4566/dynamodb"
echo "   4. SQS Admin: http://localhost:4566/sqs"
echo ""
echo "📝 To test the API:"
echo "   curl -X POST http://localhost:3000/tasks -H 'Content-Type: application/json' -d '{\"answer\":\"test answer\"}'" 