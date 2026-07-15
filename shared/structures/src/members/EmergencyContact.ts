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

    /**
     * A single line representation, e.g. 'Oma: An Peeters (0470 12 34 56)'. Parts that are missing are left out.
     */
    toString() {
        const name = this.title && this.name ? `${this.title}: ${this.name}` : (this.title || this.name);

        if (this.phone) {
            return name ? `${name} (${this.phone})` : this.phone;
        }

        return name;
    }

    private static looksLikePhone(value: string): boolean {
        if (!/^[+\d][\d\s()/.+-]*$/.test(value)) {
            return false;
        }

        const digitCount = (value.match(/\d/g) ?? []).length;
        return digitCount >= 4;
    }

    /**
     * Parses a single line representation (as produced by toString) back into an emergency contact, so exported
     * contacts can be re-imported. Returns null when the line is empty. Because toString collapses title and name
     * into one slot when only one of them is set, a line without a 'title: name' separator is treated as the name.
     */
    static fromString(str: string): EmergencyContact | null {
        const trimmed = str.trim();
        if (!trimmed) {
            return null;
        }

        let rest = trimmed;
        let phone: string | null = null;

        // A trailing '(...)' only holds the phone when there is a name/title in front of it (see toString)
        if (trimmed.endsWith(')')) {
            const openIndex = trimmed.lastIndexOf('(');
            if (openIndex > 0) {
                const prefix = trimmed.substring(0, openIndex).trim();
                const inner = trimmed.substring(openIndex + 1, trimmed.length - 1).trim();

                if (prefix.length > 0 && inner.length > 0) {
                    rest = prefix;
                    phone = inner;
                }
            }
        }

        let title = '';
        let name = '';

        const separatorIndex = rest.indexOf(': ');
        if (separatorIndex !== -1) {
            title = rest.substring(0, separatorIndex).trim();
            name = rest.substring(separatorIndex + 2).trim();
        }
        else if (rest.length > 0) {
            if (phone === null && this.looksLikePhone(rest)) {
                phone = rest;
            }
            else {
                name = rest;
            }
        }

        if (!name && !title && !phone) {
            return null;
        }

        const contact = EmergencyContact.create({ name, title, phone });
        contact.cleanData();
        return contact;
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
