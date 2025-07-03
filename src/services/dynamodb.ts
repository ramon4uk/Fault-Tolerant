import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Task, TaskStatus } from '../types';

// Check if we're running in development mode for LocalStack
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_LOCAL || process.env.IS_OFFLINE;

let dynamoClient: DynamoDBClient;
let dynamoDocClient: DynamoDBDocumentClient;

dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(isDevelopment && {
    endpoint: 'http://localhost:4566',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.TASKS_TABLE || 'learn-dlq-tasks-local';

export class TaskService {
  private tableName: string;

  constructor() {
    this.tableName = TABLE_NAME;
  }

  async createTask(taskId: string, answer: string): Promise<Task> {
    const task: Task = {
      taskId,
      answer,
      status: TaskStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retries: 0
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: task
    });

    await dynamoDocClient.send(command);
    console.log(`📝 Created task in DynamoDB: ${taskId}`);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { taskId }
    });

    const result = await dynamoDocClient.send(command);
    const task = result.Item as Task | undefined;
    
    console.log(`🔍 Retrieved task from DynamoDB: ${taskId} - ${task ? 'Found' : 'Not found'}`);
    return task || null;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    const updateExpression = 'SET #status = :status, #updatedAt = :updatedAt' + (error ? ', #error = :error' : '');
    const expressionAttributeNames: any = {
      '#status': 'status',
      '#updatedAt': 'updatedAt'
    };
    const expressionAttributeValues: any = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };

    if (error) {
      expressionAttributeNames['#error'] = 'error';
      expressionAttributeValues[':error'] = error;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { taskId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await dynamoDocClient.send(command);
    console.log(`✏️ Updated task ${taskId} status in DynamoDB to: ${status}`);
  }

  async incrementRetryCount(taskId: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { taskId },
      UpdateExpression: 'SET #retries = #retries + :inc, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#retries': 'retries',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString()
      }
    });

    await dynamoDocClient.send(command);
    console.log(`🔄 Incremented retry count for task ${taskId} in DynamoDB`);
  }

  async getAllTasks(): Promise<Task[]> {
    const command = new ScanCommand({
      TableName: this.tableName
    });

    const result = await dynamoDocClient.send(command);
    const tasks = (result.Items as Task[]) || [];
    
    console.log(`�� Retrieved ${tasks.length} tasks from DynamoDB`);
    return tasks;
  }
}