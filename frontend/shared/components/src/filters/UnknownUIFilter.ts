import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";

import { UIFilter, UIFilterBuilder } from "./UIFilter";
import UnknownUIFilterView from "./UnknownUIFilterView.vue";

export class UnknownUIFilter extends UIFilter {
    builder!: UnknownFilterBuilder
    value: StamhoofdFilter

    constructor(data: Partial<UnknownUIFilter>, options: {isInverted?: boolean} = {}) {
        super(data, options)
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        return this.value
    }

    flatten() {
        return super.flatten()
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(UnknownUIFilterView, {
            filter: this
        })
    }

    get styledDescription() {
        return [
            {
                text: $t(`ae457502-49f4-4513-923b-86f353197b0e`),
                style: ''
            }
        ]
    }
}

export class UnknownFilterBuilder implements UIFilterBuilder<UnknownUIFilter> {
    get name() {
        return $t(`ae457502-49f4-4513-923b-86f353197b0e`);
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        return new UnknownUIFilter({
            builder: this,
            value: filter
        })
    }
    
    create(options: {isInverted?: boolean} = {}): UnknownUIFilter {
        return new UnknownUIFilter({
            builder: this,
            value: {}
        }, options)
    }
}
