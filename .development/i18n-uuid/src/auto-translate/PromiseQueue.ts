export class PromiseQueue<T> {
    private itemsWaiting: PromiseQueueItem<T>[] = [];
    private itemsNext: PromiseQueueItem<T>[] = [];
    private itemsInProgress: PromiseQueueItem<T>[] = [];
    private timeout: NodeJS.Timeout | null = null;

    get concurrentItemsCount() {
        return this.itemsNext.length + this.itemsInProgress.length;
    }

    constructor(
        private readonly maxConcurrentItems: number,
        private readonly msInterval?: number,
    ) {}

    async add(callback: () => Promise<any>): Promise<T> {
        const item = new PromiseQueueItem(callback);

        if (this.concurrentItemsCount < this.maxConcurrentItems) {
            this.itemsNext.push(item);
        } else {
            this.itemsWaiting.push(item);
        }

        this.start();
        return await item.getResult();
    }

    private start() {
        if (this.timeout !== null) {
            return;
        }

        this.executeNext();
        this.timeout = setInterval(() => this.executeNext(), this.msInterval);
    }

    private stop() {
        if (this.timeout) {
            clearInterval(this.timeout);
            this.timeout = null;
        }
    }

    private check() {
        const waitCount = this.itemsWaiting.length;

        if (waitCount === 0) {
            if (this.itemsNext.length === 0) {
                this.stop();
            }
            return;
        }

        const extraItems = Math.min(
            waitCount,
            this.maxConcurrentItems - this.concurrentItemsCount,
        );

        if (extraItems <= 0) {
            return;
        }

        const itemsToExecute = this.itemsWaiting.splice(0, extraItems);
        this.itemsNext.push(...itemsToExecute);
        this.start();
    }

    private executeNext() {
        const next = this.itemsNext.shift();

        if (next) {
            this.itemsInProgress.push(next);
            next.execute()
                .catch((error) => {
                    next.reject(error);
                })
                .finally(() => {
                    this.itemsInProgress = this.itemsInProgress.filter(
                        (i) => i !== next,
                    );
                    this.check();
                });
        }
    }
}

class PromiseQueueItem<T> {
    private readonly promise: Promise<T>;
    private _resolve: ((value: T | PromiseLike<T>) => void) | null = null;
    private _reject: ((reason?: any) => void) | null = null;
    private _isCalled = false;

    get isCalled() {
        return this._isCalled;
    }

    constructor(readonly callback: () => Promise<T>) {
        this.promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    async getResult(): Promise<T> {
        return await this.promise;
    }

    async execute(): Promise<T> {
        this._isCalled = true;
        const result = await this.callback();
        this._resolve!(result);
        return result;
    }

    reject(reason?: any) {
        if (this._reject) {
            this._reject(reason);
        }
    }
}
