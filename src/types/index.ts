export interface Task {
  taskId: string;
  answer: string;
  status: TaskStatus;
  retries: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DLQ = 'DLQ'
}

export interface TaskSubmissionRequest {
  answer: string;
}

export interface TaskSubmissionResponse {
  taskId: string;
  status: TaskStatus;
  message: string;
}

export interface TaskStatusResponse {
  tasks: Task[];
}

export interface SQSTaskMessage {
  taskId: string;
  answer: string;
  retries: number;
}

// Alias for backward compatibility
export type TaskMessage = SQSTaskMessage;

export interface DLQMessage {
  taskId: string;
  answer: string;
  retries: number;
  errorMessage: string;
  timestamp: string;
}