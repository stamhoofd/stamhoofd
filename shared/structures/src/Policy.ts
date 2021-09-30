import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding"
import { v4 as uuidv4 } from "uuid";

import { File } from "./files/File"

export class Policy extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    /**
     * Set either file or url for the policy. If both are set, the url has priority
     */
    @field({ decoder: File, nullable: true, version: 25 })
    file: File | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 25 })
    url: string | null = null

    get calculatedUrl(): string {
        if (this.url !== null) {
            return this.url
        }
        return this.file?.getPublicPath() ?? ""
    }
}