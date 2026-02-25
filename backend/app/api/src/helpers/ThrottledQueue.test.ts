import { ThrottledQueue } from './ThrottledQueue.js';

describe('ThrottledQueue', () => {
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
        const queue = new ThrottledQueue(handler);

        expect(queue.handler).toBe(handler);
        expect(queue.items.size).toBe(0);
        expect(queue.timeout).toBeNull();
    });

    it('should add items to the queue', () => {
        const handler = jest.fn();
        const queue = new ThrottledQueue(handler);

        queue.addItem(1);
        expect(queue.items.size).toBe(1);
        expect(queue.items.has(1)).toBe(true);
    });

    it('should add multiple items to the queue', () => {
        const handler = jest.fn();
        const queue = new ThrottledQueue(handler);

        queue.addItems([1, 2, 3]);
        expect(queue.items.size).toBe(3);
        expect(queue.items.has(1)).toBe(true);
        expect(queue.items.has(2)).toBe(true);
        expect(queue.items.has(3)).toBe(true);
    });

    it('should flush automatically when reaching maxBatchSize', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new ThrottledQueue(handler);
        queue.maxBatchSize = 3;

        // Spy on flushAll to check if it's called
        const flushAllSpy = jest.spyOn(queue, 'flushAll');

        queue.addItems([1, 2]);
        expect(flushAllSpy).not.toHaveBeenCalled();

        queue.addItem(3);
        expect(flushAllSpy).toHaveBeenCalled();

        // Wait for all promises to resolve
        await queue.wait();

        expect(handler).toHaveBeenCalledWith([1, 2, 3]);
        expect(queue.items.size).toBe(0);
    });

    it('should process items in batches when exceeding maxBatchSize', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new ThrottledQueue(handler);
        queue.maxBatchSize = 3;

        const items = [1, 2, 3, 4, 5, 6, 7];
        queue.addItems(items);
        await queue.wait();

        // Expecting multiple calls with batches of appropriate size
        expect(handler).toHaveBeenCalledTimes(3);

        // Check if all items were processed
        const processedItems = new Set([
            ...handler.mock.calls[0][0],
            ...handler.mock.calls[1][0],
            ...handler.mock.calls[2][0],
        ]);

        expect(processedItems.size).toBe(items.length);
        items.forEach(item => expect(processedItems.has(item)).toBe(true));
    });

    it('should call emptyHandler when queue becomes empty', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new ThrottledQueue(handler);
        const emptyHandler = jest.fn();
        queue.emptyHandler = emptyHandler;

        queue.maxBatchSize = 3;
        queue.addItems([1, 2, 3]);
        await queue.wait();

        expect(emptyHandler).toHaveBeenCalled();
    });

    it('should not call emptyHandler when queue is filled during processing', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new ThrottledQueue(handler);
        const emptyHandler = jest.fn();
        queue.emptyHandler = emptyHandler;

        queue.maxBatchSize = 3;
        queue.addItems([1, 2, 3]);
        // flush happened automatically above
        queue.addItems([1]);
        await queue.wait();

        expect(emptyHandler).not.toHaveBeenCalled();

        await queue.flushAndWait();
        expect(emptyHandler).toHaveBeenCalled();
    });

    it('should not fail if handler throws an error', async () => {
        const error = new Error('Test error');
        const handler = jest.fn().mockRejectedValue(error);
        const queue = new ThrottledQueue(handler);

        // Spy on console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        queue.addItem(1);
        await queue.flushAndWait();

        expect(handler).toHaveBeenCalledWith([1]);
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error processing batch in ThrottledQueue:');

        consoleErrorSpy.mockRestore();
    });

    it('should handle flushAndWait when queue is empty', async () => {
        const handler = jest.fn();
        const queue = new ThrottledQueue(handler);

        await queue.flushAndWait();
        expect(handler).not.toHaveBeenCalled();
    });

    it('should allow adding items while processing', async () => {
        // Setup a handler that adds more items to the queue when called
        const queue = new ThrottledQueue(async (items: number[]) => {
            if (items.includes(1)) {
                queue.addItem(4);
            }
        });

        queue.addItems([1, 2, 3]);
        await queue.flushAndWait();

        expect(queue.items.size).toBe(1);
        expect(queue.items.has(4)).toBe(true);
    });

    it('should handle startTimeout and stopTimeout correctly', async () => {
        const handler = jest.fn();
        const queue = new ThrottledQueue(handler);
        queue.maxDelay = 1000; // Set a max delay for the timeout

        queue.addItem(1);
        expect(queue.timeout).not.toBeNull();

        await queue.flushAndWait();
        expect(queue.timeout).toBeNull();
    });

    it('should automatically flush after maxDelay', async () => {
        const handler = jest.fn().mockResolvedValue(undefined);
        const queue = new ThrottledQueue(handler);
        queue.maxDelay = 1000; // Set a max delay for the timeout

        queue.addItem(1);
        expect(queue.timeout).not.toBeNull();

        jest.advanceTimersByTime(500);
        await queue.wait();
        expect(handler).not.toHaveBeenCalled();

        // Fast-forward time
        jest.advanceTimersByTime(500);

        await queue.wait();
        expect(handler).toHaveBeenCalledWith([1]);
        expect(queue.items.size).toBe(0);
        expect(queue.timeout).toBeNull();
    });
});
