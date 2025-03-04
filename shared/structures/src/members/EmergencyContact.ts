import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

export class EmergencyContact extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder })
    title = '';

    @field({ decoder: DateDecoder, version: 367 })
    createdAt = new Date();

    /**
     * Stores the timestamp the contact was last edited in the UI (not the same as edited in the database - this is used to find the most correct data in case of duplicates)
     */
    @field({ decoder: DateDecoder, nullable: true, version: 367 })
    updatedAt: Date | null = null;

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.name)) {
            this.name = Formatter.capitalizeWords(this.name.toLowerCase());
        }
        if (StringCompare.isFullCaps(this.title)) {
            this.title = this.title.toLowerCase();
        }

        this.name = Formatter.capitalizeFirstLetter(this.name.trim());
        this.title = this.title.trim();
        this.title = Formatter.capitalizeFirstLetter(this.title);
    }

    isEqual(other: EmergencyContact) {
        this.cleanData();
        other.cleanData();
        return this.name === other.name && this.phone === other.phone && this.title === other.title;
    }

    merge(other: EmergencyContact) {
        if (other.name.length > 0) {
            this.name = other.name;
        }

        if (other.phone) {
            this.phone = other.phone;
        }

        if (other.title) {
            this.title = other.title;
        }
    }
}
