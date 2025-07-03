import { SQSClient, SendMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { TaskMessage } from '../types';

// Check if we're running in development mode for LocalStack
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_LOCAL || process.env.IS_OFFLINE;

let sqsClient: SQSClient;

sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(isDevelopment && {
    endpoint: 'http://localhost:4566',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

export class SQSService {
  private taskQueueUrl: string;
  private dlqUrl: string;

  constructor() {
    this.taskQueueUrl = process.env.TASK_QUEUE_URL || 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/learn-dlq-task-queue-local';
    this.dlqUrl = process.env.DLQ_URL || 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/learn-dlq-task-dlq-local';
  }

  async sendTaskToQueue(taskMessage: TaskMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.taskQueueUrl,
      MessageBody: JSON.stringify(taskMessage),
      MessageAttributes: {
        TaskId: {
          StringValue: taskMessage.taskId,
          DataType: 'String'
        }
      }
    });

    await sqsClient.send(command);
    console.log(`📬 Sent task to SQS queue: ${taskMessage.taskId}`);
  }

  async sendTaskToDLQ(taskMessage: TaskMessage, reason: string): Promise<void> {
    const dlqMessage = {
      ...taskMessage,
      dlqReason: reason,
      dlqTimestamp: new Date().toISOString()
    };

    const command = new SendMessageCommand({
      QueueUrl: this.dlqUrl,
      MessageBody: JSON.stringify(dlqMessage),
      MessageAttributes: {
        TaskId: {
          StringValue: taskMessage.taskId,
          DataType: 'String'
        },
        DLQReason: {
          StringValue: reason,
          DataType: 'String'
        }
      }
    });

    await sqsClient.send(command);
    console.log(`💀 Sent task to DLQ: ${taskMessage.taskId} - Reason: ${reason}`);
  }

  async getQueueAttributes(queueUrl: string): Promise<any> {
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    });

    const result = await sqsClient.send(command);
    return result.Attributes;
  }
}