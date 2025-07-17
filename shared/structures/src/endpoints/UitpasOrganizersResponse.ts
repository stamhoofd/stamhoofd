import { AutoEncoder, StringDecoder, field, IntegerDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';

export class UitpasOrganizerResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;
}

export class UitpasOrganizersResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    totalItems: number;

    @field({ decoder: new ArrayDecoder(UitpasOrganizerResponse) })
    member: UitpasOrganizerResponse[];
}
