import { AutoEncoder, StringDecoder, field, IntegerDecoder, ArrayDecoder, DateDecoder } from '@simonbackx/simple-encoding';

export class UitpasEventResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder })
    location: string;

    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null;
}

export class UitpasEventsResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    totalItems: number;

    @field({ decoder: IntegerDecoder })
    itemsPerPage: number;

    @field({ decoder: new ArrayDecoder(UitpasEventResponse) })
    member: UitpasEventResponse[];
}
