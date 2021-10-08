import { ArrayDecoder, AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { PropertyFilter, PropertyFilterDecoderFromContext } from "../../filters/PropertyFilter";
import { RecordSettings } from "./RecordSettings";

export class RecordCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    /**
     * A category can either have childCategories or records, but never both. Records are ignored as soon as the category has at least one child category.
     * Currently we only support 2 categories deep
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    childCategories: RecordCategory[] = []

    @field({ decoder: new ArrayDecoder(RecordSettings) })
    records: RecordSettings[] = []

    getAllRecords(): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return this.childCategories.flatMap(c => c.getAllRecords())
        }
        return this.records
    }

    @field({ decoder: new PropertyFilterDecoderFromContext(), version: 126, nullable: true })
    filter: PropertyFilter<any> | null = null
}