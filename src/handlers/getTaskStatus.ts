import { APIGatewayProxyHandler } from 'aws-lambda';
import { TaskService } from '../services/dynamodb';
import { TaskStatusResponse } from '../types';

const taskService = new TaskService();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const tasks = await taskService.getAllTasks();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(tasks)
    };
  } catch (error) {
    console.error('Error fetching task status:', error);
    
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