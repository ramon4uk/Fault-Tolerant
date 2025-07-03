// Global test setup
// Mock environment variables for testing
process.env.DYNAMODB_TABLE_NAME = 'test-tasks-table';
process.env.TASK_QUEUE_URL = 'http://localhost:4566/000000000000/test-task-queue';
process.env.DLQ_URL = 'http://localhost:4566/000000000000/test-dlq';
process.env.AWS_REGION = 'us-east-1';
process.env.IS_LOCAL = 'true';

// Setup Jest timeout
jest.setTimeout(30000);

// Mock console methods in tests to reduce noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Mock console methods
  console.log = jest.fn() as any;
  console.error = jest.fn() as any;
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test utilities
export const createMockEvent = (body?: any) => ({
  body: body ? JSON.stringify(body) : null,
  headers: {
    'Content-Type': 'application/json',
  },
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {
    requestId: 'test-request-id',
  },
});

export const createMockContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1.0.0',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-aws-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn() as any,
  fail: jest.fn() as any,
  succeed: jest.fn() as any,
});

export const createMockSQSEvent = (records: any[]) => ({
  Records: records.map(record => ({
    messageId: record.messageId || 'test-message-id',
    receiptHandle: record.receiptHandle || 'test-receipt-handle',
    body: JSON.stringify(record.body),
    attributes: {
      ApproximateReceiveCount: record.receiveCount || '1',
      SentTimestamp: record.sentTimestamp || Date.now().toString(),
    },
    messageAttributes: {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1',
  })),
}); 