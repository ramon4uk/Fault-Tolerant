#!/bin/bash

# Test script for the learn-dlq API endpoints
BASE_URL="http://localhost:3000"

echo "🧪 Testing learn-dlq API endpoints..."
echo ""

# Test 1: Submit a task
echo "1️⃣  Testing task submission..."
RESPONSE=$(curl -s -X POST $BASE_URL/tasks \
  -H 'Content-Type: application/json' \
  -d '{"answer":"This is a test answer"}')

echo "Response: $RESPONSE"

# Extract taskId from response (assuming jq is available, fallback to grep)
if command -v jq &> /dev/null; then
    TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
else
    TASK_ID=$(echo $RESPONSE | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
fi

echo "Task ID: $TASK_ID"
echo ""

# Test 2: Get task status
if [ "$TASK_ID" != "null" ] && [ "$TASK_ID" != "" ]; then
    echo "2️⃣  Testing task status retrieval..."
    STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks?taskId=$TASK_ID")
    echo "Status Response: $STATUS_RESPONSE"
    echo ""
else
    echo "❌ Could not extract task ID, skipping status test"
fi

# Test 3: Submit a task that might fail (for DLQ testing)
echo "3️⃣  Testing task that might trigger failure..."
FAIL_RESPONSE=$(curl -s -X POST $BASE_URL/tasks \
  -H 'Content-Type: application/json' \
  -d '{"answer":"fail"}')

echo "Fail Response: $FAIL_RESPONSE"
echo ""

# Test 4: Test error handling
echo "4️⃣  Testing error handling (empty request)..."
ERROR_RESPONSE=$(curl -s -X POST $BASE_URL/tasks \
  -H 'Content-Type: application/json' \
  -d '{}')

echo "Error Response: $ERROR_RESPONSE"
echo ""

echo "✅ API testing complete!"
echo ""
echo "💡 Check your terminal running 'npm start' to see the Lambda function logs"
echo "🔍 You can also check LocalStack logs: docker logs learn-dlq-localstack" 