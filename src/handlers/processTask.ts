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
      const { taskId, answer, retries } = message;

      console.log(`Processing task ${taskId}, attempt ${retries + 1}`);

      // Update task status to PROCESSING
      await taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING);

      // Simulate task processing
      const processingSuccess = simulateTaskProcessing();

      if (processingSuccess) {
        // Task processed successfully
        console.log(`Task ${taskId} processed successfully`);
        await taskService.updateTaskStatus(taskId, TaskStatus.PROCESSED);
      } else {
        // Task failed - implement retry logic
        console.log(`Task ${taskId} failed, retry count: ${retries}`);
        
        if (shouldRetry(retries)) {
          // Increment retry count in DynamoDB
          await taskService.incrementRetryCount(taskId);
          
          // Calculate backoff delay
          const delaySeconds = calculateBackoffDelay(retries);
          
          console.log(`Retrying task ${taskId} in ${delaySeconds} seconds`);
          
          // Send back to queue with delay
          await sqsService.sendTaskToQueue({
            taskId,
            answer,
            retries: retries + 1
          });
          
          await taskService.updateTaskStatus(
            taskId, 
            TaskStatus.PENDING, 
            `Retry ${retries + 1} scheduled`
          );
        } else {
          // Max retries exceeded - send to DLQ
          console.log(`Task ${taskId} exceeded max retries, sending to DLQ`);
          
          // Explicitly send to DLQ with reason
          await sqsService.sendTaskToDLQ({
            taskId,
            answer,
            retries
          }, 'Max retries exceeded after task processing failures');
          
          // Set status to FAILED for frontend (DLQ is internal)
          await taskService.updateTaskStatus(
            taskId, 
            TaskStatus.FAILED, 
            'Max retries exceeded'
          );
        }
      }
    } catch (error) {
      console.error('Error processing SQS message:', error);
      
      // Try to extract taskId from the record for DLQ routing
      try {
        const message: SQSTaskMessage = JSON.parse(record.body);
        const { taskId, answer, retries } = message;
        
        // Send to DLQ for critical processing errors
        await sqsService.sendTaskToDLQ({
          taskId,
          answer,
          retries
        }, `Critical processing error: ${error instanceof Error ? error.message : String(error)}`);
        
        await taskService.updateTaskStatus(
          taskId,
          TaskStatus.FAILED,
          `Critical error: ${error instanceof Error ? error.message : String(error)}`
        );
        
        console.log(`Task ${taskId} sent to DLQ due to critical error`);
      } catch (parseError) {
        console.error('Could not parse message for DLQ routing:', parseError);
        // If we can't parse the message, let SQS handle it
        throw error;
      }
    }
  }
};