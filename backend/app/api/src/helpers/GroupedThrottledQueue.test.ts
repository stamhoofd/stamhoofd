import { GroupedThrottledQueue } from './GroupedThrottledQueue.js';

describe('GroupedThrottledQueue', () => {
    // Mock timers for controlling setTimeout
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should create an instance with the provided handler', () => {
        const handler = jest.fn();
        const queue = new GroupedThrottledQueue(handler);

        expect(queue.handler).toBe(handler);
        expect(queue.queues.size).toBe(0);
    });

    it('should call handler when processing items from a group', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);
        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledWith('group1', [1]);
    });

    it('should process items from different groups separately', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);
        queue.addItem('group2', 2);

        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledWith('group1', [1]);
        expect(handler).toHaveBeenCalledWith('group2', [2]);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should batch items from the same group', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItems('group1', [1, 2, 3]);

        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('group1', [1, 2, 3]);
    });

    it('should flush only the specified group', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);
        queue.addItem('group2', 2);

        await queue.flushGroupAndWait('group1');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('group1', [1]);

        // Flush the remaining group
        await queue.flushGroupAndWait('group2');
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith('group2', [2]);
    });

    it('should remove the group when all items are processed', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);

        expect(queue.queues.size).toBe(1);
        expect(queue.queues.has('group1')).toBe(true);

        await queue.flushAndWait();

        // Group should be removed because the queue is empty
        expect(queue.queues.size).toBe(0);
        expect(queue.queues.has('group1')).toBe(false);
    });

    it('should handle multiple items added to the same group', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);
        queue.addItem('group1', 2);
        queue.addItem('group1', 3);

        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('group1', expect.arrayContaining([1, 2, 3]));
    });

    it('should handle large batch sizes correctly', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue<number>(handler);

        // Create a large array of items
        const items = Array.from({ length: 150 }, (_, i) => i);

        queue.addItems('group1', items);

        await queue.flushAndWait();

        // Due to the default maxBatchSize of 100, we expect multiple handler calls
        expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1);

        // Verify all items were processed
        const processedItems = handler.mock.calls.flatMap(call => call[1]);
        expect(processedItems).toHaveLength(items.length);
        expect(new Set(processedItems)).toEqual(new Set(items));
    });

    it('should handle errors in handler without failing the queue', async () => {
        const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation();

        const handler = jest.fn().mockImplementation((group, items) => {
            if (group === 'error-group') {
                throw new Error('Test error');
            }
        });

        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('error-group', 1);
        queue.addItem('normal-group', 2);

        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledWith('error-group', [1]);
        expect(handler).toHaveBeenCalledWith('normal-group', [2]);
        expect(consoleErrorMock).toHaveBeenCalled();

        // Both groups should be removed because their queues are empty
        expect(queue.queues.size).toBe(0);

        consoleErrorMock.mockRestore();
    });

    it('should handle async handler functions', async () => {
        let processingPromise: Promise<void> | null = null;

        const handler = jest.fn().mockImplementation((group, items) => {
            processingPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 10);
            });
            return processingPromise;
        });

        const queue = new GroupedThrottledQueue<number>(handler);

        queue.addItem('group1', 1);
        const waitPromise = queue.flushAndWait();

        // Check that the handler was called
        expect(handler).toHaveBeenCalled();
        expect(queue.queues.size).toBe(1);

        // Fast-forward time to resolve the processing promise
        jest.advanceTimersByTime(100);

        // Wait for the processing to complete
        await waitPromise;

        // The group should be removed now
        expect(queue.queues.size).toBe(0);
    });

    it('should not error when flushing non-existing groups', async () => {
        const handler = jest.fn();
        const queue = new GroupedThrottledQueue<number>(handler);

        await expect(queue.flushGroupAndWait('non-existing')).resolves.not.toThrow();
        queue.flushGroup('non-existing'); // Should not throw

        expect(handler).not.toHaveBeenCalled();
    });

    it('should automatically flush after maxDelay', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new GroupedThrottledQueue(handler);
        queue.maxDelay = 1000; // Set a max delay for the timeout

        queue.addItem('group-1', 1);
        expect(queue.timeout).not.toBeNull();

        jest.advanceTimersByTime(500);

        queue.addItem('group-2', 2);
        await queue.wait();
        expect(handler).not.toHaveBeenCalled();

        // Fast-forward time
        jest.advanceTimersByTime(500);

        await queue.wait();
        expect(handler).toHaveBeenCalledWith('group-1', [1]);
        expect(handler).toHaveBeenCalledWith('group-2', [2]);
        expect(queue.queues.size).toBe(0);
        expect(queue.timeout).toBeNull();
    });
});
