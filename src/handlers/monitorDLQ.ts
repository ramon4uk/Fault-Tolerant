import { SQSHandler } from 'aws-lambda';
import { TaskService } from '../services/dynamodb';
import { DLQMessage, TaskStatus } from '../types';

const taskService = new TaskService();

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      // Parse the DLQ message (enhanced format from sendTaskToDLQ)
      const rawMessage = JSON.parse(record.body);
      const dlqMessage: DLQMessage = {
        taskId: rawMessage.taskId,
        answer: rawMessage.answer,
        retries: rawMessage.retries,
        errorMessage: rawMessage.dlqReason || 'Unknown error',
        timestamp: rawMessage.dlqTimestamp || new Date().toISOString()
      };

      const { taskId, answer, retries, errorMessage, timestamp } = dlqMessage;

      console.log('=== DLQ MESSAGE DETECTED ===');
      console.log(`Task ID: ${taskId}`);
      console.log(`Answer: ${answer}`);
      console.log(`Retry Count: ${retries}`);
      console.log(`DLQ Reason: ${errorMessage}`);
      console.log(`DLQ Timestamp: ${timestamp}`);
      console.log(`Record Message ID: ${record.messageId}`);
      console.log(`Receipt Handle: ${record.receiptHandle}`);
      console.log('============================');

      // Log structured data for CloudWatch Insights
      console.log(JSON.stringify({
        eventType: 'DLQ_MESSAGE',
        taskId,
        answer,
        retryCount: retries,
        dlqReason: errorMessage,
        dlqTimestamp: timestamp,
        messageId: record.messageId,
        receiptHandle: record.receiptHandle,
        approximateReceiveCount: record.attributes.ApproximateReceiveCount,
        sentTimestamp: record.attributes.SentTimestamp,
        severity: 'ERROR'
      }));

      // Update task status in DynamoDB if not already marked as FAILED
      const task = await taskService.getTask(taskId);
      if (task && task.status !== TaskStatus.FAILED) {
        await taskService.updateTaskStatus(
          taskId, 
          TaskStatus.FAILED, 
          errorMessage || 'Task failed after max retries'
        );
        console.log(`Updated task ${taskId} status to FAILED in DynamoDB`);
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