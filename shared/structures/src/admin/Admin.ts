import { AutoEncoder, EmailDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";

export class Admin extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    email: string;
}

export class EditAdmin extends AutoEncoder {
    @field({ decoder: EmailDecoder })
    email: string

    @field({ decoder: StringDecoder })
    password: string
}