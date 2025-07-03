#!/usr/bin/env node

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure for LocalStack
const lambda = new AWS.Lambda({
  region: 'us-east-1',
  endpoint: 'http://localhost:3002', // serverless-offline endpoint
  accessKeyId: 'test',
  secretAccessKey: 'test'
});

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  accessKeyId: 'test',
  secretAccessKey: 'test'
});

// Create task directly in DB for testing
async function createTestTask(answer) {
  const taskId = uuidv4();
  const task = {
    taskId,
    answer,
    status: 'PENDING',
    retries: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await dynamodb.put({
    TableName: 'learn-dlq-tasks-local',
    Item: task
  }).promise();
  
  console.log('✅ Created test task:', taskId);
  return task;
}

// Test processTask function directly
async function testProcessTask(taskId, answer) {
  console.log('⚡ Testing processTask directly...');
  
  const sqsEvent = {
    Records: [{
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:learn-dlq-task-queue-local',
      body: JSON.stringify({ taskId, answer }),
      messageAttributes: {},
      md5OfBody: 'test',
      receiptHandle: 'test-receipt-handle'
    }]
  };
  
  try {
    const result = await lambda.invoke({
      FunctionName: 'learn-dlq-local-processTask',
      Payload: JSON.stringify(sqsEvent)
    }).promise();
    
    console.log('✅ processTask completed');
    return JSON.parse(result.Payload);
  } catch (error) {
    console.error('❌ processTask error:', error);
    throw error;
  }
}

// Test retry mechanism
async function testRetryFlow(taskId, answer) {
  console.log('🔄 Testing retry flow...');
  
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Retry ${i + 1} ---`);
    
    try {
      await testProcessTask(taskId, answer);
      
      // Check status after processing
      const task = await dynamodb.get({
        TableName: 'learn-dlq-tasks-local',
        Key: { taskId }
      }).promise();
      
      console.log('📊 Task status:', task.Item?.status);
      console.log('🔢 Retries:', task.Item?.retries);
      
      if (task.Item?.status === 'PROCESSED') {
        console.log('✅ Task completed successfully!');
        break;
      }
      
      if (task.Item?.status === 'FAILED') {
        console.log('❌ Task failed after max retries');
        break;
      }
      
    } catch (error) {
      console.error(`❌ Retry ${i + 1} failed:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting manual local tests...\n');
  
  try {
    // 1. Create a test task
    const task = await createTestTask('Manual test - simulate processing');
    
    // 2. Test single processing
    console.log('\n=== Testing Single Process ===');
    await testProcessTask(task.taskId, task.answer);
    
    // 3. Create another task for retry testing
    const retryTask = await createTestTask('Retry test - will fail initially');
    
    // 4. Test retry flow
    console.log('\n=== Testing Retry Flow ===');
    await testRetryFlow(retryTask.taskId, retryTask.answer);
    
    // 5. Show final status
    console.log('\n=== Final Status ===');
    const allTasks = await dynamodb.scan({
      TableName: 'learn-dlq-tasks-local'
    }).promise();
    
    console.log('📊 All tasks:');
    allTasks.Items.forEach(task => {
      console.log(`- ${task.taskId}: ${task.status} (retries: ${task.retries})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { createTestTask, testProcessTask, testRetryFlow }; 