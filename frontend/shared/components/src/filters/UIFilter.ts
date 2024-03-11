import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

export type UIFilterWrapper = ((value: StamhoofdFilter) => StamhoofdFilter);
export type UIFilterBuilders = UIFilterBuilder[]
export interface UIFilterBuilder<F extends UIFilter = UIFilter> {
    /**
     * Create a new default filter
     */
    create(): F
    name: string
    wrapFilter?: UIFilterWrapper|null
}

export type StyledDescription = {text: string; style: string}[]

export abstract class UIFilter {
    id = uuidv4();
    builder: UIFilterBuilder

    constructor(data) {
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
        return this.styledDescription.map(s => s.text).join();
    }
    
    abstract get styledDescription(): StyledDescription
}
