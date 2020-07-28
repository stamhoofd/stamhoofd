import { AutoEncoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

export class InviteUserDetails extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder, nullable: true })
    email: string | null = null;
}