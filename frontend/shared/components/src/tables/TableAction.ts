import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { Toast } from "../..";

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

    async handle(item: T[]) {
        const promise = this.handler(item)

        if (!promise) {
            return
        }

        let toast: Toast | null = null

        const timer = setTimeout(() => {
            toast = new Toast("Actie uitvoeren...", "spinner").setHide(null).show()
        }, 2000)

        return promise.then((v) => {
            if (toast) {
                toast.hide()
                toast = null
            }
            clearTimeout(timer)
            return v
        })
    }
}