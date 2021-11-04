import { ArrayDecoder,AutoEncoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding"

/**
 * Keep a timestamp of when certain information was reviewed of a member
 */
export class ReviewTime extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name: "records" | "parents" | "emergencyContacts" | "details"

    /**
     * Date that this section was reviewed
     */
    @field({ decoder: DateDecoder })
    reviewedAt: Date
}

export class ReviewTimes extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(ReviewTime) })
    times: ReviewTime[] = []

    markReviewed(name: "records" | "parents" | "emergencyContacts" | "details", date?: Date) {
        for (const time of this.times) {
            if (time.name === name) {
                if (date && date < time.reviewedAt) {
                    // Can't decrease time
                    return
                }
                time.reviewedAt = date ?? new Date()
                return
            }
        }
        this.times.push(ReviewTime.create({
            name,
            reviewedAt: date ?? new Date()
        }))
    }

    removeReview(name: "records" | "parents" | "emergencyContacts" | "details") {
        this.times = this.times.filter(t => t.name !== name)
    }

    getLastReview(name?: "records" | "parents" | "emergencyContacts" | "details"): Date | undefined {
        if (!name) {
            if (this.times.length == 0) {
                return
            }
            return new Date(Math.min(...this.times.map(t => t.reviewedAt.getTime())))
        }
        for (const time of this.times) {
            if (time.name === name) {
                return time.reviewedAt
            }
        }
    }

    merge(other: ReviewTimes) {
        for (const time of other.times) {
            this.markReviewed(time.name as any, time.reviewedAt)
        }
    }

    isOutdated(name: "records" | "parents" | "emergencyContacts" | "details", timeoutMs: number): boolean {
        const time = this.getLastReview(name)
        if (!time) {
            return true
        }
        if (time.getTime() < new Date().getTime() - timeoutMs) {
            return true
        }
        return false
    }
}