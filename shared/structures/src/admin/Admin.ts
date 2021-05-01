import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";

export class Admin extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    email: string;
}