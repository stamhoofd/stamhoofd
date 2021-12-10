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

    singleSelection = false

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
    }
}