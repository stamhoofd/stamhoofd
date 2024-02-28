import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

export interface UIFilterBuilder<F extends UIFilter = UIFilter> {
    /**
     * Create a new default filter
     */
    create(): F
    name: string
}

export type StyledDescription = {text: string; style: string}[]

export abstract class UIFilter {
    id = uuidv4();
    
    /**
     * Returns the filter object to pass to the backend or to apply locally
     */
    abstract build(): StamhoofdFilter
    
    clone(): UIFilter {
        const f = new (this.constructor as any)();
        Object.assign(f, this);
        return f;
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
