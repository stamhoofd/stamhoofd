import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter,StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

export class EmergencyContact extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = "";

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder })
    title = "Oma"; // TODO

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.name)) {
            this.name = Formatter.capitalizeWords(this.name.toLowerCase())
        }
        if (StringCompare.isFullCaps(this.title)) {
            this.title = this.title.toLowerCase()
        }

        this.name = Formatter.capitalizeFirstLetter(this.name.trim())
        this.title = this.title.trim()
        this.title = Formatter.capitalizeFirstLetter(this.title)
    }
}
