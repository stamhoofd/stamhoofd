import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { isEmptyFilter, PropertyFilter, StamhoofdFilter, StamhoofdNotFilter, unwrapFilter, wrapFilter, WrapperFilter } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export type UIFilterWrapper = ((value: StamhoofdFilter) => StamhoofdFilter);
export type UIFilterUnwrapper = ((value: StamhoofdFilter) => StamhoofdFilter | null);

export type UIFilterBuilders = UIFilterBuilder[];
export interface UIFilterBuilder<F extends UIFilter = UIFilter> {
    /**
     * Create a new default filter
     */
    create(options?: { isInverted?: boolean }): F;
    name: string;

    /**
     * Hide in creation
     */
    allowCreation?: boolean;

    wrapper?: WrapperFilter;
    additionalUnwrappers?: WrapperFilter[];

    // More complicated wrapper support:
    wrapFilter?: UIFilterWrapper | null | undefined;
    unwrapFilter?: UIFilterUnwrapper | null | undefined;

    fromFilter(filter: StamhoofdFilter): UIFilter | null;
}

export function unwrapFilterForBuilder(builder: UIFilterBuilder, filter: StamhoofdFilter): { match: boolean; markerValue?: StamhoofdFilter | undefined; leftOver?: StamhoofdFilter; isInverted?: boolean } {
    for (const wrapper of [builder.wrapper!, ...(builder.additionalUnwrappers ?? [])].filter(w => !!w) as WrapperFilter[]) {
        const result = unwrapFilter(filter, wrapper);

        if (!result.match) {
            const invertedFilter = UIFilter.invertFilter(filter);

            if (invertedFilter) {
                const invertedResult = unwrapFilter(invertedFilter, wrapper);

                if (invertedResult.match) {
                    return {
                        ...invertedResult,
                        isInverted: true,
                    };
                }
            }
        }

        if (result.match) {
            return result;
        }
    }

    if (builder.unwrapFilter) {
        const r = builder.unwrapFilter(filter);

        if (r === null) {
            const invertedFilter = UIFilter.invertFilter(filter);

            if (invertedFilter) {
                const invertedResult = builder.unwrapFilter(invertedFilter);
                if (invertedResult !== null) {
                    return {
                        match: true,
                        markerValue: invertedResult,
                        isInverted: true,
                    };
                }
            }
        }
        else {
            return {
                match: true,
                markerValue: r,
            };
        }
    }

    return {
        match: builder.wrapper === undefined && !builder.unwrapFilter,
        markerValue: filter,
    };
}

export type StyledDescriptionChoice = { id: string; text: string; action: () => void; isSelected: () => boolean };
export type StyledDescription = { text: string; style: string; choices?: StyledDescriptionChoice[] }[];
export type UiFilterOptions = { isInverted?: boolean };

export abstract class UIFilter {
    id = uuidv4();
    builder!: UIFilterBuilder;
    isInverted = false;

    constructor(data: Partial<UIFilter>, options: UiFilterOptions = {}) {
        Object.assign(this, data);

        if (options.isInverted) {
            this.isInverted = true;
        }
    }

    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    abstract doBuild(): StamhoofdFilter | null;

    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    build(): StamhoofdFilter | null {
        const filter = this.buildFilter();

        if (this.isInverted) {
            return UIFilter.invertFilter(filter);
        }

        return filter;
    }

    private buildFilter(): StamhoofdFilter | null {
        const b = this.doBuild();
        if (b !== null && this.builder.wrapFilter) {
            return this.builder.wrapFilter(b);
        }

        if (this.builder.wrapper) {
            return wrapFilter(b, this.builder.wrapper);
        }

        return b;
    }

    static invertFilter(filter: StamhoofdFilter | null) {
        if (filter === null) {
            return null;
        }

        if (typeof filter !== 'object') {
            throw new SimpleError({
                code: 'filter_invert_fail',
                message: $t('Inverteren van de filter is mislukt'),
            });
        }

        const keys = Object.keys(filter);

        if (keys.length === 1 && keys[0] === '$not') {
            return (filter as StamhoofdNotFilter).$not;
        }

        return {
            $not: filter,
        };
    }

    clone(): UIFilter {
        const f = new (this.constructor as any)();
        Object.assign(f, this);
        f.id = uuidv4();
        return f;
    }

    flatten(): UIFilter | null {
        return this;
    }

    /**
     * Return the Vue component to edit this filter
     */
    abstract getComponent(): ComponentWithProperties;

    get description(): string {
        return this.styledDescription.map((s) => {
            if ('choices' in s && s.choices) {
                return s.choices.find(c => c.isSelected())?.text ?? '';
            }
            return s.text;
        }).join(' ');
    }

    abstract get styledDescription(): StyledDescription;
}

export function filterToString(filter: StamhoofdFilter, builder: UIFilterBuilder) {
    const uiFilter = builder.fromFilter(filter);
    if (uiFilter) {
        return uiFilter.description;
    }
    return $t(`Onleesbare filter`);
}

export function propertyFilterToString(filter: PropertyFilter, builder: UIFilterBuilder) {
    if (filter.enabledWhen === null || isEmptyFilter(filter.enabledWhen)) {
        if (filter.requiredWhen === null) {
            return $t(`Optioneel`);
        }
        if (isEmptyFilter(filter.requiredWhen)) {
            return $t(`Verplicht`);
        }

        return $t(`Verplicht in te vullen als:`) + ' ' + filterToString(filter.requiredWhen, builder) + ' ' + $t(`(anders optioneel)`);
    }

    const enabledDescription = filterToString(filter.enabledWhen, builder);

    if (filter.requiredWhen === null) {
        return $t(`Wordt enkel gevraagd als:`) + ' ' + enabledDescription + ' ' + $t(`(optioneel)`);
    }

    if (isEmptyFilter(filter.requiredWhen)) {
        return $t(`Wordt enkel gevraagd als:`) + ' ' + enabledDescription;
    }

    return $t(`Wordt enkel gevraagd als:`) + ' ' + enabledDescription + ' ' + $t(`(enkel verplicht invullen als:`) + ' ' + filterToString(filter.requiredWhen, builder) + ')';
}
