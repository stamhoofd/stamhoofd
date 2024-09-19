import { SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { isEmptyFilter, PropertyFilter, StamhoofdCompareValue, StamhoofdFilter, StamhoofdNotFilter } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

export type UIFilterWrapper = ((value: StamhoofdFilter) => StamhoofdFilter);
export type UIFilterUnwrapper = ((value: StamhoofdFilter) => StamhoofdFilter|null);

export type UIFilterBuilders = UIFilterBuilder[]
export interface UIFilterBuilder<F extends UIFilter = UIFilter> {
    /**
     * Create a new default filter
     */
    create(options?: {isInverted?: boolean}): F
    name: string
    wrapper?: WrapperFilter

    // More complicated wrapper support:
    wrapFilter?: UIFilterWrapper|null|undefined
    unwrapFilter?: UIFilterUnwrapper|null|undefined

    fromFilter(filter: StamhoofdFilter): UIFilter|null
}

export function unwrapFilterForBuilder(builder: UIFilterBuilder, filter: StamhoofdFilter): {match: boolean, markerValue?: StamhoofdFilter|undefined, leftOver?: StamhoofdFilter, isInverted?: boolean} {
    if (builder.wrapper) {
        const result = unwrapFilter(filter, builder.wrapper);

        if(!result.match) {
            const invertedFilter = UIFilter.invertFilter(filter);

            if(invertedFilter) {
                const invertedResult = unwrapFilter(invertedFilter, builder.wrapper);

                if(invertedResult.match) {
                    return {
                        ...invertedResult,
                        isInverted: true
                    }
                }
            }
        }

        return result;
    }

    if (builder.unwrapFilter) {
        const r = builder.unwrapFilter(filter);

        if(r === null) {
            const invertedFilter = UIFilter.invertFilter(filter);

            if(invertedFilter) {
                const invertedResult = builder.unwrapFilter(invertedFilter)
                if(invertedResult !== null) {
                    return {
                        match: true,
                        markerValue: invertedResult,
                        isInverted: true
                    }
                }
            }
        }

        return {
            match: true,
            markerValue: r
        }
    }

    return {
        match: true,
        markerValue: filter
    };
}

export const UIFilterWrapperMarker = Symbol('UIFilterWrapperMarker')
export type WrapperFilter = StamhoofdFilter<StamhoofdCompareValue | typeof UIFilterWrapperMarker>

export function wrapFilter(filter: StamhoofdFilter, wrap: WrapperFilter): StamhoofdFilter {
    // Replace the UIFilterWrapperMarker symbol in wrap with filter
    if (wrap === UIFilterWrapperMarker) {
        return filter;
    }

    if (typeof wrap === 'object' && wrap !== null) {
        const o = {};
        for (const key in wrap) {
            (o as any)[key] = wrapFilter(filter, (wrap as any)[key]);
        }
        return o;
    }

    if (Array.isArray(wrap)) {
        return wrap.map(w => wrapFilter(filter, w));
    }

    return wrap;
}

/**
 * Essentially, this checks if filter and wrap are the same, but ignoring comparison if wrap is UIFilterWrapperMarker
 * If multiple UIFilterWrapperMarker are used, their value should be the same - otherwise undefined is returned
 * Returns the filter at UIFilterWrapperMarker if it is found
 * If no UIFilterWrapperMarker is found, the filter is returned if it is the same as wrap
 */
export function unwrapFilter(filter: StamhoofdFilter, wrap: WrapperFilter): {match: boolean, markerValue?: StamhoofdFilter|undefined, leftOver?: StamhoofdFilter} {
    // Replace the UIFilterWrapperMarker symbol in wrap with filter
    if (wrap === UIFilterWrapperMarker) {
        return {
            match: true,
            markerValue: filter
        }
    }

    if (Array.isArray(wrap)) {
        if (!Array.isArray(filter)) {
            return {
                match: false
            }
        }

        if (filter.length !== wrap.length) {
            return {
                match: false
            }
        }

        const remaining = filter.slice();
        let pendingMarkerValue = undefined;

        // Order should not matter in an Array
        for (const item of wrap) {
            // Check if we find a match
            if (item === UIFilterWrapperMarker) {
                // Usage like this is dangerous and unpredictable
                console.warn("UIFilterWrapperMarker in array is not supported as this requires checking in any possible permutation of the array.");
                return {
                    match: false
                }
            }

            let found = false;
            for (let i = 0; i < remaining.length; i++) {
                const same = unwrapFilter(remaining[i], item);

                if (same.match && !same.leftOver) {
                    if (same.markerValue) {
                        if (pendingMarkerValue !== undefined) {
                            // Check if equal
                            const {match, leftOver} = unwrapFilter(pendingMarkerValue, same.markerValue);
                            
                            if (!match || leftOver) {
                                // Pattern did match, but multiple marker values with different values
                                return {
                                    match: false
                                }
                            }
                        }

                        pendingMarkerValue = same.markerValue;
                    }

                    remaining.splice(i, 1);
                    found = true;
                    break;
                }
            }

            if (!found) {
                return {
                    match: false
                }
            }
        }
        
        if (remaining.length > 0) {
            return {
                match: false
            }
        }

        return {
            match: true,
            markerValue: pendingMarkerValue
        }
    }

    if (wrap instanceof Date) {
        if (filter instanceof Date) {
            return {
                match: filter.getTime() === wrap.getTime()
            }
        }

        return {
            match: false
        }
    }

    if (typeof wrap === 'object' && wrap !== null) {
        if (typeof filter !== 'object' || filter === null) {
            // Not the same
            return {
                match: false
            };
        }

        let pendingMarkerValue = undefined;
        for (const key in wrap) {
            const filterValue = (filter as any)[key];

            if (filterValue === undefined) {
                // Required key not found
                return {
                    match: false
                }
            }

            const wrapValue = (wrap as any)[key];

            const same = unwrapFilter(filterValue, wrapValue);

            if (!same.match || same.leftOver) {
                // Not matching
                return {
                    match: false
                }
            }

            // We have a match
            if (same.markerValue) {
                if (pendingMarkerValue !== undefined) {
                    // Check if equal
                    const {match, leftOver} = unwrapFilter(pendingMarkerValue, same.markerValue);
                    
                    if (!match || leftOver) {
                        // Pattern did match, but multiple marker values with different values
                        return {
                            match: false
                        }
                    }
                }

                pendingMarkerValue = same.markerValue;
            }
        }

        // We have a match
        const leftOverKeys = Object.keys(filter).filter(k => !(k in wrap));
        const leftOver = {};
        for (const key of leftOverKeys) {
            (leftOver as any)[key] = (filter as any)[key];
        }

        return {
            match: true,
            markerValue: pendingMarkerValue,
            leftOver: leftOverKeys.length ? leftOver : undefined
        };
    }

    // Only scalar values at this point
    // No marker found
    if (filter == wrap) {
        return {
            match: true
            // No marker value
        };
    }
    return {
        match: false
    };
}

export function unwrapFilterByPath(filter: StamhoofdFilter, keyPath: (string|number)[]): StamhoofdFilter|null {
    if (keyPath.length === 0) {
        return filter;
    }
    const first = keyPath[0]

    if (typeof first === 'number') {
        if (!Array.isArray(filter)) {
            return null;
        }
        if (first >= filter.length) {
            return null;
        }
        return unwrapFilterByPath((filter as any)[first], keyPath.slice(1));
    }

    if (!(typeof filter === 'object')) {
        return null;
    }

    if (filter === null) {
        return null;
    }

    
    if (first in filter) {
        return unwrapFilterByPath((filter as any)[first], keyPath.slice(1));
    }

    return null;
}

export type StyledDescriptionChoice = {id: string; text: string; action: () => void; isSelected: () => boolean};
export type StyledDescription = {text: string; style: string, choices?: StyledDescriptionChoice[]}[]

export abstract class UIFilter {
    id = uuidv4();
    builder!: UIFilterBuilder
    isInverted = false;

    constructor(data: Partial<UIFilter>, options: {isInverted?: boolean} = {}) {
        Object.assign(this, data);

        if(options.isInverted) {
            this.isInverted = true;
        }
    }
    
    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    abstract doBuild(): StamhoofdFilter|null

    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    build(): StamhoofdFilter|null {
        const filter = this.buildFilter();

        if(this.isInverted) {
            return UIFilter.invertFilter(filter);
        }

        return filter;
    }

    private buildFilter(): StamhoofdFilter | null {
        const b = this.doBuild()
        if (b !== null && this.builder.wrapFilter) {
            return this.builder.wrapFilter(b)
        }

        if (this.builder.wrapper) {
            return wrapFilter(b, this.builder.wrapper)
        }
        
        return b
    }

    static invertFilter(filter: StamhoofdFilter | null) {
        if(filter === null) {
            return null;
        }

        if(typeof filter !== 'object') {
            throw new SimpleError({
                code: 'filter_invert_fail',
                message: 'Inverteren van de filter is mislukt',
            })
        }

        const keys = Object.keys(filter);

        if(keys.length === 1 && keys[0] === '$not') {
            return (filter as StamhoofdNotFilter).$not;
        }

        return {
            $not: filter
        }
    }
    
    clone(): UIFilter {
        const f = new (this.constructor as any)();
        Object.assign(f, this);
        f.id = uuidv4();
        return f;
    }

    flatten(): UIFilter|null {
        return this;
    }

    /**
     * Return the Vue component to edit this filter
     */
    abstract getComponent(): ComponentWithProperties
    
    get description(): string {
        return this.styledDescription.map(s => s.text).join('');
    }
    
    abstract get styledDescription(): StyledDescription
}

export function filterToString(filter: StamhoofdFilter, builder: UIFilterBuilder) {
    const uiFilter = builder.fromFilter(filter);
    if (uiFilter) {
        return uiFilter.description;
    }
    return 'Onleesbare filter'
}

export function propertyFilterToString(filter: PropertyFilter, builder: UIFilterBuilder) {
    if (filter.enabledWhen === null || isEmptyFilter(filter.enabledWhen)) {
        if (filter.requiredWhen === null) {
            return 'Optioneel';
        }
        if (isEmptyFilter(filter.requiredWhen)) {
            return 'Verplicht';
        }

        return "Verplicht in te vullen als: "+ filterToString(filter.requiredWhen, builder) + ' (anders optioneel)'
    }
    
    const enabledDescription = filterToString(filter.enabledWhen, builder);

    if (filter.requiredWhen === null) {
        return 'Wordt enkel gevraagd als: ' + enabledDescription+ ' (optioneel)'
    }

    if (isEmptyFilter(filter.requiredWhen)) {
        return 'Wordt enkel gevraagd als: ' + enabledDescription
    }

    return 'Wordt enkel gevraagd als: ' + enabledDescription+ ' (enkel verplicht invullen als: '+filterToString(filter.requiredWhen, builder)+')'
}
