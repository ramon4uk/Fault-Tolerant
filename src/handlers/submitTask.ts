import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { TaskService } from '../services/dynamodb';
import { SQSService } from '../services/sqs';
import { TaskSubmissionRequest, TaskSubmissionResponse, TaskStatus } from '../types';

const taskService = new TaskService();
const sqsService = new SQSService();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}') as TaskSubmissionRequest;
    
    if (!body.answer) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Answer is required'
        })
      };
    }

    const taskId = uuidv4();
    
    // Create task in DynamoDB
    const task = await taskService.createTask(taskId, body.answer);
    
    // Send task to SQS for processing
    await sqsService.sendTaskToQueue({
      taskId,
      answer: body.answer,
      retries: 0
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(task)
    };
  } catch (error) {
    console.error('Error submitting task:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};