import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class Customer extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName: string
    
    @field({ decoder: StringDecoder })
    lastName: string

    @field({ decoder: StringDecoder })
    email: string

    @field({ decoder: StringDecoder })
    phone: string
}