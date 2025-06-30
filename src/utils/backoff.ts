export function calculateBackoffDelay(retryCount: number): number {
  const baseDelaySeconds = parseInt(process.env.BASE_DELAY_SECONDS || '2');
  const maxDelaySeconds = parseInt(process.env.MAX_DELAY_SECONDS || '900');
  
  const delaySeconds = Math.min(
    baseDelaySeconds * Math.pow(2, retryCount),
    maxDelaySeconds
  );
  
  return delaySeconds;
}

export function shouldRetry(retryCount: number): boolean {
  const maxRetries = parseInt(process.env.MAX_RETRIES || '2');
  return retryCount < maxRetries;
}