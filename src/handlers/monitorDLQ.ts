import { SQSHandler } from 'aws-lambda';
import { TaskService } from '../services/dynamodb';
import { DLQMessage } from '../types';

const taskService = new TaskService();

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      // Parse the DLQ message
      const dlqMessage: DLQMessage = {
        ...JSON.parse(record.body),
        timestamp: new Date().toISOString()
      };

      const { taskId, answer, retryCount, errorMessage, timestamp } = dlqMessage;

      console.log('=== DLQ MESSAGE DETECTED ===');
      console.log(`Task ID: ${taskId}`);
      console.log(`Answer: ${answer}`);
      console.log(`Retry Count: ${retryCount}`);
      console.log(`Error Message: ${errorMessage || 'Max retries exceeded'}`);
      console.log(`Timestamp: ${timestamp}`);
      console.log(`Record Message ID: ${record.messageId}`);
      console.log(`Receipt Handle: ${record.receiptHandle}`);
      console.log('============================');

      // Log structured data for CloudWatch Insights
      console.log(JSON.stringify({
        eventType: 'DLQ_MESSAGE',
        taskId,
        answer,
        retryCount,
        errorMessage: errorMessage || 'Max retries exceeded',
        timestamp,
        messageId: record.messageId,
        receiptHandle: record.receiptHandle,
        approximateReceiveCount: record.attributes.ApproximateReceiveCount,
        sentTimestamp: record.attributes.SentTimestamp
      }));

      // Update task status in DynamoDB if not already marked as DLQ
      const task = await taskService.getTask(taskId);
      if (task && task.status !== 'DLQ') {
        await taskService.updateTaskStatus(
          taskId, 
          'DLQ' as any, 
          errorMessage || 'Task routed to DLQ after max retries'
        );
        console.log(`Updated task ${taskId} status to DLQ in DynamoDB`);
      }

      // You could add additional monitoring actions here:
      // - Send alerts to SNS
      // - Create support tickets
      // - Send notifications to Slack/Teams
      // - Store in a separate monitoring table

    } catch (error) {
      console.error('Error processing DLQ message:', error);
      console.error('Raw record:', JSON.stringify(record, null, 2));
      
      // Don't throw error here as we want to acknowledge the DLQ message
      // even if our monitoring fails
    }
  }
};