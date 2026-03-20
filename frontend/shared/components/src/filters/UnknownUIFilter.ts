import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { StamhoofdFilter } from '@stamhoofd/structures';

import type { UIFilterBuilder } from './UIFilter';
import { UIFilter } from './UIFilter';
import UnknownUIFilterView from './UnknownUIFilterView.vue';

export class UnknownUIFilter extends UIFilter<UnknownFilterBuilder> {
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
                text: $t(`%bu`),
                style: ''
            }
        ]
    }
}

export class UnknownFilterBuilder implements UIFilterBuilder<UnknownUIFilter> {
    get name() {
        return $t(`%bu`);
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
