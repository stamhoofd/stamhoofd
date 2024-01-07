import { SimpleError } from "@simonbackx/simple-errors"

export class RateLimitWindow {
    start: Date = new Date()
    windows: Map<string, number> = new Map()

    limit: number

    /**
     * in ms
     */
    duration: number

    constructor(options: {
        limit: number,
        duration: number
    }) {
        this.limit = options.limit
        this.duration = options.duration
    }

    isExpired() {
        return this.age > this.duration
    }

    get age() {
        return Date.now() - this.start.getTime()
    }

    track(key: string, amount = 1) {
        if (this.isExpired()) {
            // We have a shared window
            this.start = new Date()
            this.windows.clear()
        }

        let w = this.windows.get(key) ?? 0
        w += amount

        if (w > this.limit) {
            const retryAfter = Math.ceil((this.duration - this.age) / 1000)
            throw new SimpleError({
                code: 'rate_limit',
                message: `Rate limit exceeded (${w} requests in ${Math.round(this.age/1000)}s). Retry after ${retryAfter}s. Check your code and try to reduce the number of (parallel) requests you make. Add waiting periods if needed.`,
                statusCode: 429
            })
        }

        // Save
        this.windows.set(key, w)
    }
}


export class RateLimiter {
    windows: RateLimitWindow[] = []

    constructor(options: {
        limits: {duration: number, limit: number}[]
    }) {
        
        for (const limit of options.limits) {
            this.windows.push(new RateLimitWindow({
                limit: limit.limit,
                duration: limit.duration
            }))
        }
    }

    track(key: string, amount = 1) {
        for (const window of this.windows) {
            window.track(key, amount)
        }
    }
}
