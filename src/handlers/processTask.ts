import { SQSHandler } from 'aws-lambda';
import { TaskService } from '../services/dynamodb';
import { SQSService } from '../services/sqs';
import { TaskStatus, SQSTaskMessage } from '../types';
import { calculateBackoffDelay, shouldRetry } from '../utils/backoff';

const taskService = new TaskService();
const sqsService = new SQSService();

// Simulate task processing with configurable failure rate
function simulateTaskProcessing(): boolean {
  const failureRate = parseFloat(process.env.FAILURE_RATE || '0.3');
  return Math.random() > failureRate;
}

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const message: SQSTaskMessage = JSON.parse(record.body);
      const { taskId, answer, retryCount } = message;

      console.log(`Processing task ${taskId}, attempt ${retryCount + 1}`);

      // Update task status to PROCESSING
      await taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING);

      // Simulate task processing
      const processingSuccess = simulateTaskProcessing();

      if (processingSuccess) {
        // Task completed successfully
        console.log(`Task ${taskId} completed successfully`);
        await taskService.updateTaskStatus(taskId, TaskStatus.COMPLETED);
      } else {
        // Task failed - implement retry logic
        console.log(`Task ${taskId} failed, retry count: ${retryCount}`);
        
        if (shouldRetry(retryCount)) {
          // Increment retry count in DynamoDB
          await taskService.incrementRetryCount(taskId);
          
          // Calculate backoff delay
          const delaySeconds = calculateBackoffDelay(retryCount);
          
          console.log(`Retrying task ${taskId} in ${delaySeconds} seconds`);
          
          // Send back to queue with delay
          await sqsService.sendTaskToQueue({
            taskId,
            answer,
            retryCount: retryCount + 1
          }, delaySeconds);
          
          await taskService.updateTaskStatus(
            taskId, 
            TaskStatus.PENDING, 
            `Retry ${retryCount + 1} scheduled`
          );
        } else {
          // Max retries exceeded - send to DLQ
          console.log(`Task ${taskId} exceeded max retries, sending to DLQ`);
          
          await taskService.updateTaskStatus(
            taskId, 
            TaskStatus.DLQ, 
            'Max retries exceeded'
          );
          
          // Note: The actual DLQ routing is handled by SQS configuration
          // This is just for logging and status tracking
          throw new Error(`Task ${taskId} failed after maximum retries`);
        }
      }
    } catch (error) {
      console.error('Error processing SQS message:', error);
      
      // If we can't parse the message or there's a critical error,
      // let SQS handle the retry/DLQ logic
      throw error;
    }
  }
};