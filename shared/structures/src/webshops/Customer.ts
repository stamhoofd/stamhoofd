import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class Customer extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = ""
    
    @field({ decoder: StringDecoder })
    lastName = ""

    @field({ decoder: StringDecoder })
    email = ""

    @field({ decoder: StringDecoder })
    phone = ""

    get name() {
        if (this.lastName === "") {
            return this.firstName
        }
        if (this.firstName === "") {
            return this.lastName
        }
        return this.firstName+" "+this.lastName
    }
}