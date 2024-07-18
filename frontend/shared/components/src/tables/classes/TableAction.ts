import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { FetchAllOptions, TableObjectFetcher } from ".";
import { Toast } from "../../..";

export interface TableActionSelection<T extends {id: string}> {
    hasSelection: boolean,
    isSingle: boolean,

    /**
     * For actions that handle on a full selection
     */
    getSelection(options?: FetchAllOptions): Promise<T[]>|T[],
    
    /**
     * If you want to manually use the filter, or query data
     */
    fetcher: TableObjectFetcher<T>,
    markedRows: Map<string, T>,
    markedRowsAreSelected: boolean
}

export abstract class TableAction<T extends {id: string}> {
    name: string;
    icon: string;
    tooltip = ""
    enabled = true

    /// Determines order
    priority: number;

    /// For grouping
    groupIndex: number

    /**
     * Whether this table action is on a whole selection. 
     * Set to false if you don't need any selection.
     * The action will be hidden if we are in selection modus on mobile
     */
    needsSelection = true

    /**
     * If this action needs a selection, we will not automatically select all items if none is selected, or when selection mode is disabled
     */
    allowAutoSelectAll = true

    singleSelection = false

    childActions: (TableAction<T>[]) | (() => TableAction<T>[])  = []
    childMenu: ComponentWithProperties | null = null

    get hasChildActions() {
        if (this.childMenu !== null) {
            return true;
        }
        if (this.childActions instanceof Array) {
            return this.childActions.length > 0
        } else {
            // function
            return true;
        }
    }

    isDisabled(hasSelection: boolean) {
        return !hasSelection && this.needsSelection && !this.allowAutoSelectAll
    }

    getChildActions(): TableAction<T>[] {
        if (this.childActions instanceof Array) {
            return this.childActions
        } else {
            return this.childActions()
        }
    }

    constructor(settings: Partial<TableAction<T>>) {
        this.name = settings.name ?? "";
        this.icon = settings.icon ?? "";
        this.priority = settings.priority ?? 0;
        this.groupIndex = settings.groupIndex ?? 0;
        this.needsSelection = settings.needsSelection ?? true;
        this.singleSelection = settings.singleSelection ?? false;
        this.tooltip = settings.tooltip ?? this.name;
        this.enabled = settings.enabled ?? true;
        this.allowAutoSelectAll = settings.allowAutoSelectAll ?? true;
        this.childActions = settings.childActions ?? [];
        this.childMenu = settings.childMenu ?? null;
    }

    setGroupIndex(index: number) {
        this.groupIndex = index
        return this
    }

    setPriority(priority: number) {
        this.priority = priority
        return this
    }

    abstract handle(data: TableActionSelection<T>): Promise<void>
}

export class MenuTableAction<T extends {id: string}> extends TableAction<T> {
    async handle(data: TableActionSelection<T>) {
        // Do nothing
    }
}

export class AsyncTableAction<T extends {id: string}> extends TableAction<T> {
    handler: (selection: TableActionSelection<T>) => Promise<void> | void

    constructor(settings: Partial<TableAction<T>> & { handler: (selection: TableActionSelection<T>) => Promise<void> | void } ) {
        super(settings)
        this.handler = settings.handler ?? (() => { throw new Error("No handler defined") });
    }

    async handle(selection: TableActionSelection<T>) {
        // todo
        await this.handler(selection)
    }
}

export class InMemoryTableAction<T extends {id: string}> extends TableAction<T> {
    handler: (item: T[]) => Promise<void> | void

    constructor(settings: Partial<TableAction<T>> & { handler: (item: T[]) => Promise<void> | void }) {
        super(settings)
        this.handler = settings.handler ?? (() => { throw new Error("No handler defined") });
    }

    async handle(data: TableActionSelection<T>) {
        const toast: Toast = new Toast("Ophalen...", "spinner").setHide(null)
        const timer = setTimeout(() => {
            toast.show()
        }, 1000)

        try {
            const items = this.needsSelection ? (await data.getSelection({
                onProgress(count, total) {
                    toast.setProgress(total !== 0 ? (count / total) : 0)
                }
            })) : [];
            toast.setProgress(1)
            toast.message = 'Actie uitvoeren...'
            await this.handler(items);
        } finally {
            clearTimeout(timer)
            toast.hide();
        }
    }
}
