import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";

import { UIFilter, UIFilterBuilder } from "./UIFilter";
import UnknownUIFilterView from "./UnknownUIFilterView.vue";

export class UnknownUIFilter extends UIFilter {
    builder!: UnknownFilterBuilder
    value: StamhoofdFilter

    constructor(data: Partial<UnknownUIFilter>) {
        super(data)
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
                text: 'Niet ondersteunde filter',
                style: ''
            }
        ]
    }
}

export class UnknownFilterBuilder implements UIFilterBuilder<UnknownUIFilter> {
    get name() {
        return 'Niet ondersteunde filter';
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        return new UnknownUIFilter({
            builder: this,
            value: filter
        })
    }
    
    create(): UnknownUIFilter {
        return new UnknownUIFilter({
            builder: this,
            value: {}
        })
    }
}
