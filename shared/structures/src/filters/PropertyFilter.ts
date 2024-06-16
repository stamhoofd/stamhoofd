
import { Data, Encodeable, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"

import { FilterGroupEncoded } from "./FilterGroup"
import { StamhoofdFilterDecoder } from "./new/FilteredRequest"
import { StamhoofdFilter } from "./new/StamhoofdFilter"
import { Filterable } from "../members/records/RecordCategory"

export class PropertyFilter implements Encodeable {
    constructor(enabledWhen: StamhoofdFilter | null, requiredWhen: StamhoofdFilter | null) {
        this.enabledWhen = enabledWhen
        this.requiredWhen = requiredWhen
    }

    static createDefault() {
        return new PropertyFilter(null, {})
    }

    /**
     * Enabled when...
     * null = always enabled
     */
    enabledWhen: StamhoofdFilter | null = null

    /**
     * If enabled, whether it is required
     * null = always skippable
     * empty filter = always required
     */
    requiredWhen: StamhoofdFilter | null = null

    isEnabled(object: Filterable): boolean {
        if (this.enabledWhen === null) {
            return true
        }
        return object.doesMatchFilter(this.enabledWhen)
    }

    isRequired(object: Filterable): boolean {
        if (this.requiredWhen === null) {
            return false
        }
        return object.doesMatchFilter(this.requiredWhen)
    }
    
    encode(context: EncodeContext): PlainObject {
        return {
            enabledWhen: this.enabledWhen as PlainObject,
            requiredWhen: this.requiredWhen as PlainObject
        }
    }

    static decode<T>(data: Data): PropertyFilter {
        if (data.context.version < 251) {
            // Legacy filters: convert to StamhoofdFilter
            const oldData = {
                enabledWhen: data.field("enabledWhen").decode(FilterGroupEncoded),
                requiredWhen: data.field("requiredWhen").nullable(FilterGroupEncoded)
            };

            return new PropertyFilter(
                oldData.enabledWhen ? convertFilterGroupEncoded(oldData.enabledWhen) : null,
                oldData.requiredWhen ? convertFilterGroupEncoded(oldData.requiredWhen) : null
            )   
        }

        return new PropertyFilter(
            data.field("enabledWhen").nullable(StamhoofdFilterDecoder),
            data.field("requiredWhen").nullable(StamhoofdFilterDecoder)
        )
    }
}


function convertFilterGroupEncoded(obj: FilterGroupEncoded<any>): StamhoofdFilter|null {
    if (obj === null) {
        return null;
    }
    return {}
}
