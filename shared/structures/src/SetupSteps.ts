import { AutoEncoder, DateDecoder, EnumDecoder, MapDecoder, NumberDecoder, field } from '@simonbackx/simple-encoding';
import { SetupStepType } from './SetupStepType.js';
import { SetupStepReview } from './SetupStepReview.js';
import { Formatter } from '@stamhoofd/utility';

export const minimumRegistrationCount: number = 1;

export class SetupStep extends AutoEncoder {
    /**
     * @deprecated
     * Removed
     */
    @field({ decoder: DateDecoder, nullable: true, field: 'reviewedAt', optional: true })
    __reviewedAt: Date | null = null;

    /**
     * When the item was marked as reviewed.
     */
    @field({ decoder: SetupStepReview, nullable: true, version: 326 })
    review: SetupStepReview | null = null;

    /**
     * When the finished and total steps last have been updated.
     */
    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    @field({ decoder: NumberDecoder })
    finishedSteps: number = 0;

    @field({ decoder: NumberDecoder })
    totalSteps: number = 1;

    transformForDiff() {
        if (this.isDone) {
            if (this.review) {
                return 'Voltooid en nagekeken op ' + Formatter.dateNumber(this.review.date);
            }
            return 'Voltooid';
        }

        return this.finishedSteps + '/' + this.totalSteps;
    }

    get isDone() {
        return this.finishedSteps >= this.totalSteps;
    }

    get isReviewed() {
        return this.review !== null;
    }

    get isComplete() {
        return this.isDone && this.isReviewed;
    }

    get progress() {
        if (!this.totalSteps) return 1;
        return this.finishedSteps / this.totalSteps;
    }

    get priority() {
        const isDone = this.isDone;
        const isReviewed = this.isReviewed;

        if (isDone && isReviewed) {
            return 0;
        }

        if (isDone && !isReviewed) {
            return 1;
        }

        if (!isDone && isReviewed) {
            return 2;
        }

        return 3;
    }

    markReviewed({ userId, userName }: { userId: string; userName: string }) {
        const now = new Date();
        if (this.review === null) {
            this.review = SetupStepReview.create({
                date: now,
                userName,
                userId,
            });
        }
    }

    resetReviewed() {
        this.review = null;
    }

    update(finishedSteps: number, totalSteps: number) {
        if (finishedSteps === this.finishedSteps && totalSteps === this.totalSteps) {
            return;
        }

        const now = new Date();

        if (totalSteps === 0) {
            finishedSteps = 1;
            totalSteps = 1;
        }

        this.finishedSteps = finishedSteps;
        this.totalSteps = totalSteps;
        this.updatedAt = now;

        if (this.finishedSteps < this.totalSteps && this.review) {
            this.resetReviewed();
        }
    }
}

export class SetupSteps extends AutoEncoder {
    @field({ decoder: new MapDecoder(new EnumDecoder(SetupStepType), SetupStep), version: 324 })
    steps: Map<SetupStepType, SetupStep> = new Map();

    get(type: SetupStepType) {
        return this.steps.get(type);
    }

    getAll(): { type: SetupStepType; step: SetupStep }[] {
        const result: { type: SetupStepType; step: SetupStep }[] = [];

        for (const value of Object.values(SetupStepType)) {
            const step = this.steps.get(value);

            if (step) {
                result.push({ type: value, step });
            }
        }

        return result;
    }

    isEmpty() {
        return this.steps.size === 0;
    }

    areAllComplete(): boolean {
        return Array.from(this.steps.values()).every(s => s.isComplete);
    }

    getStepsToDoOverview(): { type: SetupStepType; step: SetupStep }[] {
        const result: { type: SetupStepType; step: SetupStep }[] = [];

        for (const value of Object.values(SetupStepType)) {
            const step = this.steps.get(value);

            if (step) {
                // filter out steps that are done and reviewed
                if (step.isDone && step.isReviewed) {
                    continue;
                }

                result.push({ type: value, step });
            }
        }

        return result;
    }

    getProgress(): { completed: number; total: number } {
        const total = this.steps.size;
        const completed = Array.from(this.steps.values()).filter(s => s.isComplete).length;
        return { completed, total };
    }

    markReviewed(stepType: SetupStepType, by: { userId: string; userName: string }) {
        const step = this.steps.get(stepType);
        if (step) {
            step.markReviewed(by);
        }
    }

    resetReviewed(stepType: SetupStepType) {
        const step = this.steps.get(stepType);
        if (step) {
            step.resetReviewed();
        }
    }

    update(stepType: SetupStepType, { finishedSteps, totalSteps }: { finishedSteps: number; totalSteps: number }) {
        const step = this.steps.get(stepType);
        if (step) {
            step.update(finishedSteps, totalSteps);
        }
        else {
            if (totalSteps === 0) {
                this.steps.set(stepType, SetupStep.create({ finishedSteps: 1, totalSteps: 1 }));
            }
            else {
                this.steps.set(stepType, SetupStep.create({ finishedSteps, totalSteps }));
            }
        }
    }
}
