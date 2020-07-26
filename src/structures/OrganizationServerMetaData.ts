import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationServerMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    privateDKIMKey?: string

    @field({ decoder: StringDecoder, optional: true })
    publicDKIMKey?: string
}