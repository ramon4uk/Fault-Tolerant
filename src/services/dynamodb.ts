import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Task, TaskStatus } from '../types';
import { MockTaskService } from './mock-services';

// Check if we should use mock services (when running locally without Docker)
const useLocalMock = process.env.IS_LOCAL === 'true' || process.env.IS_OFFLINE === 'true';

// Configure DynamoDB client for local development
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_LOCAL || process.env.IS_OFFLINE;

let ddbClient: DynamoDBClient;
let docClient: DynamoDBDocumentClient;

if (!useLocalMock) {
  ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(isDevelopment && {
      endpoint: 'http://localhost:4566',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    }),
  });
  
  docClient = DynamoDBDocumentClient.from(ddbClient);
}

const TABLE_NAME = process.env.TASKS_TABLE || 'learn-dlq-tasks-local';

export class TaskService {
  private tableName: string;
  private mockService?: MockTaskService;

  constructor() {
    this.tableName = TABLE_NAME;
    if (useLocalMock) {
      this.mockService = new MockTaskService();
      console.log('🎭 Using mock DynamoDB service for local testing');
    }
  }

  async createTask(taskId: string, answer: string): Promise<Task> {
    if (this.mockService) {
      return this.mockService.createTask(taskId, answer);
    }

    const task: Task = {
      taskId,
      answer,
      status: TaskStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: task
    });

    await docClient.send(command);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    if (this.mockService) {
      return this.mockService.getTask(taskId);
    }

    const command = new GetCommand({
      TableName: this.tableName,
      Key: { taskId }
    });

    const result = await docClient.send(command);
    return result.Item as Task || null;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    if (this.mockService) {
      return this.mockService.updateTaskStatus(taskId, status, error);
    }

    const updateExpression = error 
      ? 'SET #status = :status, updatedAt = :updatedAt, #error = :error'
      : 'SET #status = :status, updatedAt = :updatedAt';
    
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    if (error) {
      expressionAttributeNames['#error'] = 'error';
    }
    
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };
    if (error) {
      expressionAttributeValues[':error'] = error;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { taskId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await docClient.send(command);
  }

  async incrementRetryCount(taskId: string): Promise<void> {
    if (this.mockService) {
      return this.mockService.incrementRetryCount(taskId);
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { taskId },
      UpdateExpression: 'SET retryCount = retryCount + :inc, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString()
      }
    });

    await docClient.send(command);
  }

  async getAllTasks(): Promise<Task[]> {
    if (this.mockService) {
      return this.mockService.getAllTasks();
    }

    const result = await docClient.send(new ScanCommand({
      TableName: this.tableName
    }));

    return result.Items as Task[] || [];
  }
}