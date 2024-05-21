import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { FetchAllOptions, Toast } from "../..";

export class TableAction<T> {
    name: string;
    icon: string;
    tooltip = ""
    enabled = true

    /// Determines order
    priority: number;

    /// For grouping
    groupIndex: number

    handler: (item: T[]) => Promise<void> | void

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
        this.handler = settings.handler ?? (() => { throw new Error("No handler defined") });
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

    async handle(data: {getSelection(options?: FetchAllOptions): Promise<T[]>|T[]}) {
        let toast: Toast = new Toast("Ophalen...", "spinner").setHide(null)
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
