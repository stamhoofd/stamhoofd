
import { Data, Encodeable, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"

import { FilterDefinition } from "./FilterDefinition"
import { FilterGroup, FilterGroupEncoded } from "./FilterGroup"

export class PropertyFilter<T> implements Encodeable {
    constructor(enabledWhen: FilterGroupEncoded<T>, requiredWhen: FilterGroupEncoded<T> | null) {
        this.enabledWhen = enabledWhen
        this.requiredWhen = requiredWhen
    }

    static createDefault<T>() {
        return new PropertyFilter<T>(new FilterGroup([]).encoded, new FilterGroup([]).encoded)
    }

    /**
     * Enabled when...
     * cannot be null (always should be enabled)
     */
    enabledWhen: FilterGroupEncoded<T>

    /**
     * If enabled, whether it is required
     */
    requiredWhen: FilterGroupEncoded<T> | null = null

    getString(definitions: FilterDefinition<T>[]): string {
        const decodedEnabledWhen = this.enabledWhen.decode(definitions)
        const decodedRequiredWhen = this.requiredWhen === null ? null : this.requiredWhen.decode(definitions)

        if (decodedEnabledWhen.filters.length == 0) {
            // Always enabled

            if (decodedRequiredWhen === null) {
                return "Stap kan worden overgeslagen"
            }
            if (decodedRequiredWhen.filters.length == 0) {
                return "Stap kan niet worden overgeslagen"
            }

            return "Stap kan niet worden overgeslagen als: "+decodedRequiredWhen.toString()
        }

        if (decodedRequiredWhen === null) {
            return "Ingeschakeld (kan altijd worden overgeslagen) als: "+decodedEnabledWhen.toString()
        }

        if (decodedRequiredWhen.filters.length == 0) {
            return "Ingeschakeld als: "+decodedEnabledWhen.toString()
        }

        return "Ingeschakeld als: "+decodedEnabledWhen+", enkel verplicht invullen als: "+decodedRequiredWhen.toString()
    }

    encode(context: EncodeContext): PlainObject {
        return {
            enabledWhen: this.enabledWhen.encode(context),
            requiredWhen: this.requiredWhen === null ? null : this.requiredWhen.encode(context)
        }
    }

    static decode<T>(data: Data): PropertyFilter<T> {
        return new PropertyFilter<T>(
            data.field("enabledWhen").decode(FilterGroupEncoded),
            data.field("requiredWhen").nullable(FilterGroupEncoded)
        )
    }
}
