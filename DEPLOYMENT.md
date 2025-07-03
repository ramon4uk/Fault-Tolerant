# Deployment Guide

This document outlines how to deploy the Learn DLQ application across different environments.

## Environment Configuration

The application supports three environments: `dev`, `staging`, and `prod`. Each environment has its own configuration file in the `config/` directory.

### Configuration Files

- `config/dev.yml` - Development environment
- `config/staging.yml` - Staging environment  
- `config/prod.yml` - Production environment

### Environment Differences

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| **Lambda Memory** | 512MB | 1024MB | 2048MB |
| **Lambda Timeout** | 300s | 300s | 900s |
| **SQS Batch Size** | 1 | 5 | 10 |
| **Max Retries** | 2 | 2 | 4 |
| **Failure Rate** | 30% | 20% | 0% |
| **Point-in-Time Recovery** | Disabled | Enabled | Enabled |
| **X-Ray Tracing** | Disabled | Enabled | Enabled |
| **Log Retention** | 7 days | 14 days | 30 days |
| **Reserved Concurrency** | None | None | 100 |

## Deployment Commands

### AWS Development Environment (Recommended)
```bash
# Deploy to AWS dev
npm run deploy:aws-dev

# Get AWS dev environment info
npm run info:aws-dev

# View AWS dev logs
npm run logs:process -- --stage aws-dev

# Remove AWS dev deployment
npm run remove:aws-dev
```

### Local Development Alternative
```bash
# Deploy to dev (alternative to aws-dev)
npm run deploy:dev

# Get dev environment info
npm run info:dev

# View dev logs
npm run logs:process -- --stage dev

# Remove dev deployment
npm run remove:dev
```

### Staging Environment
```bash
# Deploy to staging
npm run deploy:staging

# Get staging environment info
npm run info:staging

# View staging logs
npm run logs:process -- --stage staging

# Remove staging deployment
npm run remove:staging
```

### Production Environment
```bash
# Deploy to production
npm run deploy:prod

# Get production environment info
npm run info:prod

# View production logs
npm run logs:process -- --stage prod

# Remove production deployment
npm run remove:prod
```

## Environment Variables

Each environment automatically configures the following environment variables for Lambda functions:

| Variable | Description |
|----------|-------------|
| `TASKS_TABLE` | DynamoDB table name |
| `TASK_QUEUE_URL` | SQS main queue URL |
| `DLQ_URL` | SQS dead letter queue URL |
| `MAX_RETRIES` | Maximum retry attempts |
| `BASE_DELAY_SECONDS` | Base delay for exponential backoff |
| `MAX_DELAY_SECONDS` | Maximum delay between retries |
| `FAILURE_RATE` | Artificial failure rate for testing |

## Resource Naming Convention

Resources are named using the pattern: `{service}-{resource}-{stage}`

Examples:
- `learn-dlq-tasks-aws-dev` (DynamoDB table)
- `learn-dlq-task-queue-prod` (SQS queue)
- `learn-dlq-task-dlq-staging` (DLQ queue)

## Pre-deployment Checklist

### Development
- [ ] AWS credentials configured
- [ ] Serverless CLI installed
- [ ] Dependencies installed (`npm install`)

### Staging
- [ ] All development features tested
- [ ] Code reviewed
- [ ] Configuration validated

### Production
- [ ] Staging deployment tested
- [ ] Monitoring alerts configured
- [ ] Backup strategy confirmed
- [ ] Rollback plan prepared

## Post-deployment Verification

After deployment, verify the following:

1. **API Endpoints**
   ```bash
   # Get endpoint URL
   npm run info:prod
   
   # Test task submission
   curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/tasks \
     -H "Content-Type: application/json" \
     -d '{"answer": "test"}'
   ```

2. **Queue Processing**
   - Check SQS queue metrics in AWS Console
   - Verify Lambda function invocations
   - Monitor DynamoDB for task records

3. **DLQ Monitoring**
   - Verify DLQ monitoring function is active
   - Check CloudWatch logs for structured logging

## Monitoring and Logs

### CloudWatch Logs
```bash
# Real-time function logs
npm run logs:submit -- --stage prod
npm run logs:process -- --stage prod
npm run logs:dlq -- --stage prod
```

### CloudWatch Insights Queries

**DLQ Messages:**
```sql
fields @timestamp, taskId, errorMessage, retryCount
| filter eventType = "DLQ_MESSAGE"
| sort @timestamp desc
| limit 100
```

**Task Processing:**
```sql
fields @timestamp, @message
| filter @message like /Processing task/
| sort @timestamp desc
| limit 100
```

## Rollback Strategy

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   # Redeploy previous version
   serverless deploy --stage prod
   ```

2. **Remove Problematic Deployment**
   ```bash
   npm run remove:prod
   # Then redeploy stable version
   ```

## Cost Optimization

### Development
- Pay-per-request DynamoDB billing
- No reserved concurrency
- Shorter log retention

### Production
- Consider provisioned capacity for high-volume scenarios
- Reserved concurrency to control costs
- Longer log retention for compliance

## Security Considerations

1. **IAM Permissions**: Least privilege principle applied
2. **Encryption**: All data encrypted at rest and in transit
3. **VPC**: Consider VPC deployment for sensitive workloads
4. **Secrets**: Use AWS Secrets Manager for sensitive configuration

## Troubleshooting

### Common Issues

1. **Deployment Fails**
   - Check AWS credentials and permissions
   - Verify Serverless CLI version compatibility
   - Check for resource limits in AWS account

2. **Functions Don't Process Messages**
   - Verify SQS trigger configuration
   - Check Lambda function permissions
   - Review CloudWatch logs for errors

3. **DynamoDB Access Issues**
   - Verify IAM role permissions
   - Check table name and region configuration
   - Confirm table exists in target environment

### Support

For deployment issues:
1. Check CloudWatch logs
2. Review AWS CloudFormation events
3. Verify configuration files
4. Test with minimal configuration first