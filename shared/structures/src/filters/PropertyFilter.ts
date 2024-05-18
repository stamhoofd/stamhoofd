
import { Data, Encodeable, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"

import { FilterGroupEncoded } from "./FilterGroup"
import { StamhoofdFilterDecoder } from "./new/FilteredRequest"
import { StamhoofdFilter } from "./new/StamhoofdFilter"

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

    getString(): string {
        //const decodedEnabledWhen = this.enabledWhen.decode(definitions)
        //const decodedRequiredWhen = this.requiredWhen === null ? null : this.requiredWhen.decode(definitions)

        //if (decodedEnabledWhen.filters.length == 0) {
        //    // Always enabled

        //    if (decodedRequiredWhen === null) {
        //        return "Stap kan worden overgeslagen"
        //    }
        //    if (decodedRequiredWhen.filters.length == 0) {
        //        return "Stap kan niet worden overgeslagen"
        //    }

        //    return "Stap kan niet worden overgeslagen als: "+decodedRequiredWhen.toString()
        //}

        //if (decodedRequiredWhen === null) {
        //    return "Ingeschakeld (kan altijd worden overgeslagen) als: "+decodedEnabledWhen.toString()
        //}

        //if (decodedRequiredWhen.filters.length == 0) {
        //    return "Ingeschakeld als: "+decodedEnabledWhen.toString()
        //}

        //return "Ingeschakeld als: "+decodedEnabledWhen+", enkel verplicht invullen als: "+decodedRequiredWhen.toString()

        return "TODO"
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
