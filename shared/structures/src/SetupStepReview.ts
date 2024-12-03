import { AutoEncoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';

export class SetupStepReview extends AutoEncoder {
    @field({ decoder: DateDecoder })
    date: Date;

    @field({ decoder: StringDecoder })
    userName: string;

    @field({ decoder: StringDecoder })
    userId: string;

    getDiffValue() {
        return this.userName;
    }
}
