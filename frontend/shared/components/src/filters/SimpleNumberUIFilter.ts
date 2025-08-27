import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { NumberFilterFormat } from './NumberUIFilter';
import SimpleNumberUIFilterView from './SimpleNumberUIFilterView.vue';
import { UIFilter, UIFilterBuilder, unwrapFilterForBuilder } from './UIFilter';

export class SimpleNumberUIFilter extends UIFilter {
    builder!: SimpleNumberFilterBuilder;
    value = 0;

    constructor(data: Partial<SimpleNumberUIFilter>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        return this.value;
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(SimpleNumberUIFilterView, {
            filter: this,
        });
    }

    get styledDescription() {
        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: ' ' + $t('is') + ' ',
                style: 'gray',
            }, {
                text: this.valueToText,
                style: '',
            },
        ];
    }

    private get valueToText() {
        switch (this.builder.type) {
            case NumberFilterFormat.Number: return this.value.toFixed(this.builder.floatingPoint ? 2 : 0);
            case NumberFilterFormat.Currency: return Formatter.price(this.value);
            case NumberFilterFormat.TimeMinutes: {
                const dateZero = new Date(0);
                dateZero.setMinutes(this.value);
                return Formatter.time(dateZero, 'utc');
            };
        }
    }
}

export class SimpleNumberFilterBuilder implements UIFilterBuilder<SimpleNumberUIFilter> {
    name = '';
    wrapper: WrapperFilter;

    floatingPoint = false;
    type = NumberFilterFormat.Number;
    defaultValue = 0;

    constructor(data: { name: string; type?: NumberFilterFormat;wrapper: WrapperFilter; defaultValue?: number }) {
        if (data.defaultValue !== undefined) {
            this.defaultValue = data.defaultValue;
        }
        this.name = data.name;
        this.wrapper = data.wrapper;
        if (data.type !== undefined) {
            this.type = data.type;
        }
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const { markerValue: unwrapped, isInverted } = unwrapFilterForBuilder(this, filter);
        if (unwrapped === null || unwrapped === undefined) {
            return null;
        }

        if (typeof unwrapped === 'number' && !isInverted) {
            return new SimpleNumberUIFilter({
                builder: this,
                value: unwrapped,
            }, { isInverted });
        }

        return null;
    }

    create(options: { isInverted?: boolean } = {}): SimpleNumberUIFilter {
        return new SimpleNumberUIFilter({
            builder: this,
            value: this.defaultValue,
        }, options);
    }
}
