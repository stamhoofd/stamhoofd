import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { isEmptyFilter,PropertyFilter, StamhoofdFilter } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

export type UIFilterWrapper = ((value: StamhoofdFilter) => StamhoofdFilter);
export type UIFilterUnwrapper = ((value: StamhoofdFilter) => StamhoofdFilter|null);

export type UIFilterBuilders = UIFilterBuilder[]
export interface UIFilterBuilder<F extends UIFilter = UIFilter> {
    /**
     * Create a new default filter
     */
    create(): F
    name: string
    wrapFilter?: UIFilterWrapper|null
    unwrapFilter?: UIFilterUnwrapper|null

    fromFilter(filter: StamhoofdFilter): UIFilter|null
}

export function unwrapFilter(filter: StamhoofdFilter, keyPath: (string|number)[]): StamhoofdFilter|null {
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
        return unwrapFilter((filter as any)[first], keyPath.slice(1));
    }

    if (!(typeof filter === 'object')) {
        return null;
    }

    if (filter === null) {
        return null;
    }

    
    if (first in filter) {
        return unwrapFilter((filter as any)[first], keyPath.slice(1));
    }

    return null;
}

export type StyledDescription = {text: string; style: string}[]

export abstract class UIFilter {
    id = uuidv4();
    builder!: UIFilterBuilder

    constructor(data: Partial<UIFilter>) {
        Object.assign(this, data);
    }
    
    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    abstract doBuild(): StamhoofdFilter|null

    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    build(): StamhoofdFilter|null {
        const b = this.doBuild()
        if (b !== null && this.builder.wrapFilter) {
            return this.builder.wrapFilter(b)
        }
        return b
    }
    
    clone(): UIFilter {
        const f = new (this.constructor as any)();
        Object.assign(f, this);
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
            return 'Stap kan worden overgeslagen';
        }
        if (isEmptyFilter(filter.requiredWhen)) {
            return 'Verplichte vragenlijst';
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
