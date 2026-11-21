import { SimpleError } from '@common/errors';

export class RateLimitWindow {
    start: Date = new Date();
    windows: Map<string, number> = new Map();

    /** Category limits; the empty-string entry is the fallback for unspecified categories. */
    limit: Map<string, number>;

    /**
     * in ms
     */
    duration: number;

    constructor(options: { limit: Map<string, number> | number; duration: number }) {
        this.limit =
            typeof options.limit === 'number' ? new Map([['', options.limit]]) : options.limit;
        this.duration = options.duration;
    }

    isExpired() {
        return this.age > this.duration;
    }

    get age() {
        return Date.now() - this.start.getTime();
    }

    getLimit(category?: string) {
        if (category) {
            return this.limit.get(category) ?? this.limit.get('') ?? 0;
        }
        return this.limit.get('') ?? 0;
    }

    reset() {
        this.start = new Date();
        this.windows.clear();
    }

    /**
     * Throw if a request would go over the limit, without counting it.
     */
    check(key: string, amount = 1, category?: string) {
        this.clearIfExpired();
        this.assertWithinLimit((this.windows.get(key) ?? 0) + amount, amount, category);
    }

    track(key: string, amount = 1, category?: string) {
        this.clearIfExpired();

        const w = (this.windows.get(key) ?? 0) + amount;
        this.assertWithinLimit(w, amount, category);

        // Save
        this.windows.set(key, w);
    }

    private clearIfExpired() {
        if (this.isExpired()) {
            // We have a shared window
            this.reset();
        }
    }

    private assertWithinLimit(count: number, amount: number, category?: string) {
        const limit = this.getLimit(category);

        if (count > limit) {
            const retryAfter = Math.ceil((this.duration - this.age) / 1000);
            throw new SimpleError({
                code: 'rate_limit',
                message: `Rate limit exceeded (${count} ${amount > 1 ? '(' + amount + ' added)' : ''} requests in ${Math.round(this.age / 1000)}s). Retry after ${retryAfter}s. Check your code and try to reduce the number of (parallel) requests you make. Add waiting periods if needed. Limit ${limit} ${category ?? ''}`,
                human: `Oeps! Te veel aanvragen. Om spam te vermijden is jouw aanvraag tijdelijk geblokkeerd. Probeer het over ${retryAfter} seconden opnieuw.`,
                statusCode: 429,
            });
        }
    }
}

export class RateLimiter {
    windows: RateLimitWindow[] = [];

    constructor(options: { limits: { duration: number; limit: Map<string, number> | number }[] }) {
        for (const limit of options.limits) {
            this.windows.push(
                new RateLimitWindow({
                    limit: limit.limit,
                    duration: limit.duration,
                }),
            );
        }
    }

    track(key: string, amount = 1, category?: string) {
        for (const window of this.windows) {
            window.track(key, amount, category);
        }
    }

    /**
     * See {@link RateLimitWindow.check}.
     */
    check(key: string, amount = 1, category?: string) {
        for (const window of this.windows) {
            window.check(key, amount, category);
        }
    }

    reset() {
        for (const window of this.windows) {
            window.reset();
        }
    }
}
