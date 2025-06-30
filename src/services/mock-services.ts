// Mock services for local testing without AWS/LocalStack
import { Task, TaskStatus, TaskMessage } from '../types';

// In-memory storage for local testing
const tasks: Map<string, Task> = new Map();
const taskQueue: TaskMessage[] = [];
const dlqQueue: (TaskMessage & { dlqReason: string; dlqTimestamp: string })[] = [];

export class MockTaskService {
  async createTask(taskId: string, answer: string): Promise<Task> {
    const task: Task = {
      taskId,
      answer,
      status: TaskStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    };

    tasks.set(taskId, task);
    console.log(`📝 Created task: ${taskId}`);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    const task = tasks.get(taskId) || null;
    console.log(`🔍 Retrieved task: ${taskId} - ${task ? 'Found' : 'Not found'}`);
    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    const task = tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      if (error) {
        task.error = error;
      }
      tasks.set(taskId, task);
      console.log(`✏️ Updated task ${taskId} status to: ${status}`);
    }
  }

  async incrementRetryCount(taskId: string): Promise<void> {
    const task = tasks.get(taskId);
    if (task) {
      task.retryCount++;
      task.updatedAt = new Date().toISOString();
      tasks.set(taskId, task);
      console.log(`🔄 Incremented retry count for task ${taskId} to: ${task.retryCount}`);
    }
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(tasks.values());
  }
}

export class MockSQSService {
  async sendTaskToQueue(taskMessage: TaskMessage): Promise<void> {
    taskQueue.push(taskMessage);
    console.log(`📬 Added task to queue: ${taskMessage.taskId}`);
    
    // Simulate processing after a short delay
    setTimeout(() => {
      this.processNextTask();
    }, 1000);
  }

  async sendTaskToDLQ(taskMessage: TaskMessage, reason: string): Promise<void> {
    const dlqMessage = {
      ...taskMessage,
      dlqReason: reason,
      dlqTimestamp: new Date().toISOString()
    };
    
    dlqQueue.push(dlqMessage);
    console.log(`💀 Added task to DLQ: ${taskMessage.taskId} - Reason: ${reason}`);
  }

  private async processNextTask(): Promise<void> {
    const taskMessage = taskQueue.shift();
    if (!taskMessage) return;

    console.log(`⚙️ Processing task: ${taskMessage.taskId}`);
    
    const mockTaskService = new MockTaskService();
    
    try {
      // Update status to processing
      await mockTaskService.updateTaskStatus(taskMessage.taskId, TaskStatus.PROCESSING);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate failure based on failure rate (30% by default)
      const failureRate = parseFloat(process.env.FAILURE_RATE || '0.3');
      const shouldFail = Math.random() < failureRate;
      
      if (shouldFail && taskMessage.retryCount < parseInt(process.env.MAX_RETRIES || '2')) {
        // Simulate transient failure
        console.log(`❌ Task ${taskMessage.taskId} failed (attempt ${taskMessage.retryCount + 1})`);
        await mockTaskService.incrementRetryCount(taskMessage.taskId);
        
        // Retry the task
        const retryMessage = { ...taskMessage, retryCount: taskMessage.retryCount + 1 };
        setTimeout(() => {
          taskQueue.push(retryMessage);
          this.processNextTask();
        }, 3000); // Retry after 3 seconds
        
      } else if (shouldFail) {
        // Max retries reached, send to DLQ
        console.log(`💀 Task ${taskMessage.taskId} failed permanently after ${taskMessage.retryCount} retries`);
        await mockTaskService.updateTaskStatus(taskMessage.taskId, TaskStatus.DLQ, 'Max retries reached');
        await this.sendTaskToDLQ(taskMessage, 'Max retries reached');
        
      } else {
        // Success
        console.log(`✅ Task ${taskMessage.taskId} completed successfully`);
        await mockTaskService.updateTaskStatus(taskMessage.taskId, TaskStatus.COMPLETED);
      }
      
    } catch (error) {
      console.error(`💥 Error processing task ${taskMessage.taskId}:`, error);
      await mockTaskService.updateTaskStatus(taskMessage.taskId, TaskStatus.FAILED, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getQueueAttributes(queueUrl: string): Promise<any> {
    return {
      ApproximateNumberOfMessages: taskQueue.length.toString(),
      ApproximateNumberOfMessagesNotVisible: '0'
    };
  }

  // Helper method to get queue status for debugging
  getQueueStatus() {
    return {
      taskQueue: taskQueue.length,
      dlqQueue: dlqQueue.length,
      tasks: tasks.size
    };
  }
} 