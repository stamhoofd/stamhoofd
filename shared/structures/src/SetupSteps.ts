import { AutoEncoder, DateDecoder, EnumDecoder, MapDecoder, NumberDecoder, field } from "@simonbackx/simple-encoding";

export enum SetupStepType {
    Premises = 'Premises',
    Groups = 'Groups'

}

export class SetupStep extends AutoEncoder {
    /**
     * When the item was marked as reviewed.
     */
    @field({ decoder: DateDecoder, nullable: true })
    reviewedAt: Date | null = null

    /**
     * When the finished and total steps last have been updated.
     */
    @field({ decoder: DateDecoder})
    updatedAt: Date = new Date();

    @field({ decoder: NumberDecoder })
    finishedSteps: number = 0

    @field({ decoder: NumberDecoder })
    totalSteps: number = 1

    get isDone() {
        return this.finishedSteps >= this.totalSteps
    }

    get shouldBeReviewed() {
        return this.reviewedAt === null;
    }

    get progress() {
        return this.finishedSteps / this.totalSteps
    }

    get priority() {
        const isDone = this.isDone;
        const isReviewed = !this.shouldBeReviewed;

        if(isDone && isReviewed) {
            return 0;
        }

        if(isDone && !isReviewed) {
            return 1;
        }
        
        if(!isDone && isReviewed) {
            return 2;
        }

        return 3;
    }

    markReviewed() {
        const now = new Date();
        if(this.reviewedAt === null || (now.getTime() > this.reviewedAt.getTime())) {
            this.reviewedAt = now;
        }
    }

    resetReviewed() {
        this.reviewedAt = null;
    }

    update(finishedSteps: number, totalSteps: number) {
        if(finishedSteps === this.finishedSteps && totalSteps === this.totalSteps) {
            return;
        }
        
        const now = new Date();

        if(totalSteps === 0) {
            finishedSteps = 1;
            totalSteps = 1;
        }

        if(this.updatedAt === null || (now.getTime() > this.updatedAt.getTime())) {
            this.finishedSteps = finishedSteps;
            this.totalSteps = totalSteps;
            this.updatedAt = now;
        }
    }
}

export class SetupSteps extends AutoEncoder {
    @field({ decoder: new MapDecoder(new EnumDecoder(SetupStepType), SetupStep), version: 324 })
    steps: Map<SetupStepType, SetupStep> = new Map()

    getAll(): {type: SetupStepType, step: SetupStep}[] {
        const result: {type: SetupStepType, step: SetupStep}[] = [];

        for(const value of Object.values(SetupStepType)) {
            const step = this.steps.get(value);

            if(step) {
                result.push({type: value, step});
            }
        }

        return result;
    }

    getStepsToDoOverview(): {type: SetupStepType, step: SetupStep}[] {
        const result: {type: SetupStepType, step: SetupStep}[] = [];

        for(const value of Object.values(SetupStepType)) {
            const step = this.steps.get(value);

            if(step) {
                // filter out steps that are done and reviewed
                if(step.isDone && !step.shouldBeReviewed) {
                    continue;
                }

                result.push({type: value, step});
            }
        }

        return result;
    }

    markReviewed(stepType: SetupStepType) {
        const step = this.steps.get(stepType);
        if(step) {
            step.markReviewed();
        }
    }

    resetReviewed(stepType: SetupStepType) {
        const step = this.steps.get(stepType);
        if(step) {
            step.resetReviewed();
        }
    }

    update(stepType: SetupStepType, {finishedSteps, totalSteps}: {finishedSteps: number, totalSteps: number}) {
        const step = this.steps.get(stepType);
        if(step) {
            step.update(finishedSteps, totalSteps);
        } else {
            this.steps.set(stepType, SetupStep.create({finishedSteps, totalSteps}));
        }
    }
}
