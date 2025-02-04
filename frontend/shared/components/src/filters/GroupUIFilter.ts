import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';

import { markRaw } from 'vue';
import GroupUIFilterView from './GroupUIFilterView.vue';
import { StyledDescription, UIFilter, UIFilterBuilder, UIFilterWrapper, unwrapFilterForBuilder } from './UIFilter';
import { UnknownFilterBuilder } from './UnknownUIFilter';

export enum GroupUIFilterMode {
    Or = 'Or',
    And = 'And',
}

export class GroupUIFilter extends UIFilter {
    filters: UIFilter[] = [];
    builder!: GroupUIFilterBuilder;
    mode: GroupUIFilterMode = GroupUIFilterMode.And;

    get builders() {
        return this.builder.builders;
    }

    doBuild(): StamhoofdFilter | null {
        if (!this.filters.length) {
            return null;
        }

        const buildFilters = this.filters.map(b => b.build()).filter(f => f !== null) as StamhoofdFilter[];
        if (buildFilters.length === 0) {
            return null;
        }

        if (buildFilters.length === 1) {
            return buildFilters[0];
        }

        return {
            [this.mode === GroupUIFilterMode.And ? '$and' : '$or']: buildFilters,
        };
    }

    clone() {
        const c = super.clone() as GroupUIFilter;
        c.filters = this.filters.map(f => f.clone());
        c.mode = this.mode;
        return c;
    }

    flatten() {
        if (this.filters.length === 0) {
            return null;
        }

        let flattened = this.builder.wrapFilter || this.builder.wrapper ? this.filters.slice() : this.filters.map(f => f?.flatten()).filter(f => !!f);

        flattened = flattened.flatMap((f) => {
            if (f instanceof GroupUIFilter && f.mode === this.mode && !f.builder.wrapFilter && !f.builder.wrapper) {
                return f.filters;
            }
            return f;
        });

        if (flattened.length === 0) {
            return null;
        }

        if (flattened.length === 1 && !this.builder.wrapFilter && !this.builder.wrapper) {
            return flattened[0];
        }

        const clone = this.clone();
        clone.filters = flattened as UIFilter[];
        return clone;
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(GroupUIFilterView, {
            filter: this,
        });
    }

    override get styledDescription(): StyledDescription {
        const array = this.filters.map(b => b.styledDescription);
        const last = array.pop();

        if (last === undefined) {
            return [];
        }

        const plast = array.pop();
        const flattened = array.flatMap(a => [...a, { text: ', ', style: 'gray' }]);
        if (plast) {
            flattened.push(...plast);
        }

        if (flattened.length > 0) {
            flattened.push({ text: this.mode === GroupUIFilterMode.And ? ' en ' : ' of ', style: 'gray' });
        }

        flattened.push(...last);

        if (this.builder.wrapper) {
            const prefix: typeof flattened = [];
            prefix.push({
                text: 'Heeft ',
                style: 'gray',
                choices: [
                    {
                        id: 'false',
                        text: 'Heeft',
                        action: () => this.isInverted = false,
                        isSelected: () => this.isInverted === false,
                    },
                    {
                        id: 'true',
                        text: 'Heeft geen',
                        action: () => this.isInverted = true,
                        isSelected: () => this.isInverted === true,
                    },
                ],
            });

            prefix.push({
                text: this.builder.name,
                style: '',
            });

            prefix.push({
                text: ' waar ',
                style: 'gray',
            });

            flattened.unshift(...prefix);
        }

        return flattened;
    }
}

export class GroupUIFilterBuilder implements UIFilterBuilder<GroupUIFilter> {
    builders: UIFilterBuilder[] = [];
    name = 'complexe filtergroep';
    description = '';
    wrapFilter?: UIFilterWrapper | null;
    wrapper?: WrapperFilter;

    constructor(data: { builders: UIFilterBuilder[]; name?: string; description?: string; wrapFilter?: UIFilterWrapper | null; wrapper?: WrapperFilter }) {
        this.builders = data.builders;
        this.name = data.name ?? this.name;
        this.description = data.description ?? this.description;
        this.wrapFilter = data.wrapFilter ?? null;
        this.wrapper = data.wrapper;

        markRaw(this);
    }

    create(options: { isInverted?: boolean } = {}): GroupUIFilter {
        return new GroupUIFilter({
            builder: this,
        }, options);
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const result = unwrapFilterForBuilder(this, filter);
        if (!result.match) {
            filter = [];
        }
        else {
            filter = result.markerValue ?? [];
        }

        let allowSelf = false;
        let mode = GroupUIFilterMode.And;
        if (typeof filter === 'object' && filter !== null && ('$and' in filter)) {
            filter = filter.$and;
            allowSelf = true;
            mode = GroupUIFilterMode.And;
        }

        if (typeof filter === 'object' && filter !== null && ('$or' in filter)) {
            filter = filter.$or;
            allowSelf = true;
            mode = GroupUIFilterMode.Or;
        }

        // Match
        const subfilters: UIFilter[] = [];
        const queue = Array.isArray(filter) ? filter.slice() : [filter];
        let c = 0;

        while (queue.length && c < 200) {
            c++;
            const f = queue.shift();
            if (f === undefined) {
                break;
            }

            for (const builder of [...this.builders, new UnknownFilterBuilder()]) {
                if (builder === this && !allowSelf) {
                    continue;
                }
                const decoded = builder.fromFilter(f);

                if (decoded !== null) {
                    if (decoded instanceof GroupUIFilter && !decoded.filters.length) {
                        continue;
                    }

                    // do we have a leftover?
                    const unwrappedF = unwrapFilterForBuilder(builder, f);

                    subfilters.push(decoded.flatten() ?? decoded);

                    if (unwrappedF.leftOver) {
                        // Keep processing this leftover one
                        queue.push(unwrappedF.leftOver);
                    }
                    break;
                }
            }
        }

        const groupFilter = this.create();
        groupFilter.filters = subfilters;
        groupFilter.mode = mode;
        if (result.isInverted) {
            groupFilter.isInverted = true;
        }
        return groupFilter;
    }
}
