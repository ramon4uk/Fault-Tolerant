import { calculateBackoffDelay, shouldRetry } from '../../src/utils/backoff';

describe('Backoff Utilities', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('calculateBackoffDelay', () => {
    test('should calculate exponential backoff correctly with default values', () => {
      // Default: BASE_DELAY_SECONDS=2, MAX_DELAY_SECONDS=900

      const backoff0 = calculateBackoffDelay(0);
      expect(backoff0).toBe(2); // 2 * 2^0 = 2

      const backoff1 = calculateBackoffDelay(1);
      expect(backoff1).toBe(4); // 2 * 2^1 = 4

      const backoff2 = calculateBackoffDelay(2);
      expect(backoff2).toBe(8); // 2 * 2^2 = 8

      const backoff3 = calculateBackoffDelay(3);
      expect(backoff3).toBe(16); // 2 * 2^3 = 16
    });

    test('should cap at maximum delay', () => {
      // Set a low max delay for testing
      process.env.BASE_DELAY_SECONDS = '10';
      process.env.MAX_DELAY_SECONDS = '50';

      const backoff0 = calculateBackoffDelay(0);
      expect(backoff0).toBe(10); // 10 * 2^0 = 10

      const backoff1 = calculateBackoffDelay(1);
      expect(backoff1).toBe(20); // 10 * 2^1 = 20

      const backoff2 = calculateBackoffDelay(2);
      expect(backoff2).toBe(40); // 10 * 2^2 = 40

      const backoff3 = calculateBackoffDelay(3);
      expect(backoff3).toBe(50); // 10 * 2^3 = 80, capped at 50

      const backoff10 = calculateBackoffDelay(10);
      expect(backoff10).toBe(50); // Should be capped at 50
    });

    test('should work with custom environment variables', () => {
      process.env.BASE_DELAY_SECONDS = '5';
      process.env.MAX_DELAY_SECONDS = '100';

      const backoff0 = calculateBackoffDelay(0);
      expect(backoff0).toBe(5); // 5 * 2^0 = 5

      const backoff1 = calculateBackoffDelay(1);
      expect(backoff1).toBe(10); // 5 * 2^1 = 10

      const backoff2 = calculateBackoffDelay(2);
      expect(backoff2).toBe(20); // 5 * 2^2 = 20
    });

    test('should handle high retry counts', () => {
      process.env.BASE_DELAY_SECONDS = '1';
      process.env.MAX_DELAY_SECONDS = '1000';

      const backoff = calculateBackoffDelay(20);
      expect(backoff).toBe(1000); // Should be capped at max delay
    });
  });

  describe('shouldRetry', () => {
    test('should return true for retry counts below maximum', () => {
      // Default MAX_RETRIES=2
      expect(shouldRetry(0)).toBe(true);
      expect(shouldRetry(1)).toBe(true);
      expect(shouldRetry(2)).toBe(false); // At max retries
      expect(shouldRetry(3)).toBe(false); // Above max retries
    });

    test('should respect custom MAX_RETRIES environment variable', () => {
      process.env.MAX_RETRIES = '5';

      expect(shouldRetry(0)).toBe(true);
      expect(shouldRetry(1)).toBe(true);
      expect(shouldRetry(4)).toBe(true);
      expect(shouldRetry(5)).toBe(false); // At max retries
      expect(shouldRetry(6)).toBe(false); // Above max retries
    });

    test('should handle zero max retries', () => {
      process.env.MAX_RETRIES = '0';

      expect(shouldRetry(0)).toBe(false);
      expect(shouldRetry(1)).toBe(false);
    });

    test('should handle invalid MAX_RETRIES', () => {
      process.env.MAX_RETRIES = 'invalid';

      // parseInt('invalid') returns NaN, so retryCount < NaN is always false
      expect(shouldRetry(0)).toBe(false);
      expect(shouldRetry(1)).toBe(false);
      expect(shouldRetry(2)).toBe(false);
    });
  });
}); 