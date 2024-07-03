import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter,MergeHelper,OnlyWritabelKeys,StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

export class EmergencyContact extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = "";

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder })
    title = ""; 

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

    isEqual(other: EmergencyContact) {
        this.cleanData();
        other.cleanData();
        return this.name === other.name && this.phone === other.phone && this.title === other.title
    }

    mergeChanges(other: EmergencyContact) {
        const changes: Partial<OnlyWritabelKeys<EmergencyContact>> = {};
        const merge = (key: keyof OnlyWritabelKeys<EmergencyContact>, checkEmpty = false) => MergeHelper.mergeChange(this, other, changes, key, checkEmpty);

        const requiredDetails: (keyof OnlyWritabelKeys<EmergencyContact>)[] = ['name', 'title'];

        requiredDetails.forEach(detail => merge(detail, true));

        const compulsoryDetails: (keyof OnlyWritabelKeys<EmergencyContact>)[] = ['phone'];

        compulsoryDetails.forEach((detail) => merge(detail));

        return changes as Partial<EmergencyContact>;
    }
}
