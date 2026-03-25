import { ArrayDecoder, AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogReplacement } from '../AuditLogReplacement.js';

export type ReviewTimeType = 'records' | 'parents' | 'emergencyContacts' | 'details' | 'uitpasNumber';

/**
 * Keep a timestamp of when certain information was reviewed of a member
 */
export class ReviewTime extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name: ReviewTimeType

    /**
     * Date that this section was reviewed
     */
    @field({ decoder: DateDecoder })
    reviewedAt: Date;

    getDiffName() {
        return AuditLogReplacement.key('reviewTime.' + this.name);
    }

    getDiffValue() {
        return AuditLogReplacement.string(Formatter.dateNumber(this.reviewedAt, true));
    }
}

export class ReviewTimes extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(ReviewTime) })
    times: ReviewTime[] = [];

    markReviewed(name: ReviewTimeType, date?: Date) {
        for (const time of this.times) {
            if (time.name === name) {
                if (date && date < time.reviewedAt) {
                    // Can't decrease time
                    return;
                }
                time.reviewedAt = date ?? new Date();
                return;
            }
        }
        this.times.push(ReviewTime.create({
            name,
            reviewedAt: date ?? new Date(),
        }));
    }

    removeReview(name: ReviewTimeType) {
        this.times = this.times.filter(t => t.name !== name);
    }

    getLastReview(name?: ReviewTimeType): Date | undefined {
        if (!name) {
            if (this.times.length === 0) {
                return;
            }
            return new Date(Math.min(...this.times.map(t => t.reviewedAt.getTime())));
        }
        for (const time of this.times) {
            if (time.name === name) {
                return time.reviewedAt;
            }
        }
    }

    merge(other: ReviewTimes) {
        for (const time of other.times) {
            this.markReviewed(time.name, time.reviewedAt);
        }
    }

    isReviewed(name: ReviewTimeType): boolean {
        const time = this.getLastReview(name);
        if (!time) {
            return false;
        }
        return true;
    }

    isOutdated(name: ReviewTimeType, timeoutMs: number): boolean {
        const time = this.getLastReview(name);
        if (!time) {
            return true;
        }
        if (time.getTime() < new Date().getTime() - timeoutMs) {
            return true;
        }
        return false;
    }

    clearAll() {
        this.times = [];
    }
}
