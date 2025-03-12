import { AutoEncoder, DateDecoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';

export class ChargeOrganizationsRequest extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null;

    @field({ decoder: StringDecoder })
    description: string;

    @field({ decoder: NumberDecoder })
    price: number;

    @field({ decoder: NumberDecoder, nullable: true })
    amount: number | null;

    @field({ decoder: DateDecoder, nullable: true })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;
}
