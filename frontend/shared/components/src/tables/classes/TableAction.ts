import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

import { LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { fetchAll, FetchAllOptions, ObjectFetcher } from '.';
import { Toast } from '../../..';

type ObjectWithId = { id: string };

export interface TableActionSelection<T extends ObjectWithId> {
    /**
     * If you want to manually use the filter, or query data
     */
    filter: LimitedFilteredRequest;
    fetcher: ObjectFetcher<T>;

    cachedAllValues?: T[];

    // Manually selected rows that are already in memory
    markedRows: Map<string, T>;

    /**
     * When true: only the marked rows are selected.
     * When false: all rows are selected, except the marked rows
     */
    markedRowsAreSelected: boolean | null;
}

type TransformTableActionArgs<X extends { id: string }, T extends { id: string }> = {
    selectionTransformer: (selection: TableActionSelection<X>) => TableActionSelection<T>;
    inMemoryTransformer: (item: X) => T;
};

type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

function transformFilter(filter: any, key: string): StamhoofdFilter {
    if (!filter) {
        return filter;
    }

    if (typeof filter === 'object') {
        if (Array.isArray(filter)) {
            return filter.map(item => transformFilter(item, key));
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const [k, value] of Object.entries(filter)) {
            if (k === key) {
                if (value?.['$elemMatch']) {
                    return value['$elemMatch'];
                };

                return filter;
            }

            if (k.startsWith('$')) {
                return transformFilter(value, key);
            }

            return {
                registrations: {
                    $elemMatch: {
                        [k]: value,
                    },
                },
            } as unknown as StamhoofdFilter;
        }
    }

    return filter;
}

export abstract class TableAction<T extends { id: string }> {
    name: string;
    description: string = '';
    icon: string;
    tooltip = '';
    enabled = true;
    destructive = false;

    /// Determines order
    priority: number;

    /// For grouping
    groupIndex: number;

    /**
     * Whether this table action is on a whole selection.
     * Set to false if you don't need any selection.
     * The action will be hidden if we are in selection modus on mobile
     */
    needsSelection = true;

    /**
     * If this action needs a selection, we will not automatically select all items if none is selected, or when selection mode is disabled
     */
    allowAutoSelectAll = true;

    singleSelection = false;

    childActions: (TableAction<T>[]) | (() => TableAction<T>[]) = [];
    childMenu: ComponentWithProperties | null = null;

    get hasChildActions() {
        if (this.childMenu !== null) {
            return true;
        }
        if (this.childActions instanceof Array) {
            return this.childActions.length > 0;
        }
        else {
            // function
            return true;
        }
    }

    isDisabled(hasSelection: boolean) {
        if (!this.allowAutoSelectAll && !hasSelection && this.needsSelection) {
            return true;
        }
        return false;
    }

    getChildActions(): TableAction<T>[] {
        if (this.childActions instanceof Array) {
            return this.childActions;
        }
        else {
            return this.childActions();
        }
    }

    constructor(settings: Partial<TableAction<T>>) {
        this.name = settings.name ?? '';
        this.description = settings.description ?? '';
        this.icon = settings.icon ?? '';
        this.priority = settings.priority ?? 0;
        this.groupIndex = settings.groupIndex ?? 0;
        this.needsSelection = settings.needsSelection ?? true;
        this.singleSelection = settings.singleSelection ?? false;
        this.tooltip = settings.tooltip ?? this.name;
        this.enabled = settings.enabled ?? true;
        this.allowAutoSelectAll = settings.allowAutoSelectAll ?? true;
        this.childActions = settings.childActions ?? [];
        this.childMenu = settings.childMenu ?? null;
        this.destructive = settings.destructive ?? false;
    }

    setGroupIndex(index: number) {
        this.groupIndex = index;
        return this;
    }

    setPriority(priority: number) {
        this.priority = priority;
        return this;
    }

    abstract handle(data: TableActionSelection<T>): Promise<void>;

    abstract _adaptToPropertyHelper<X extends { id: string }>(args: TransformTableActionArgs<X, T>): TableAction<X>;

    /**
     * Adapt the action to reuse with a different table where the value for the provided key is the type for this action.
     * @returns a new adapted action
     */
    adaptToProperty<X extends { id: string }>({ key, fetcher }: { key: KeysMatching<X, T> & string; fetcher: ObjectFetcher<T> }): TableAction<X> {
        return this._adaptToPropertyHelper<X>({
            inMemoryTransformer: item => item[key] as T,
            selectionTransformer: (selection) => {
                const filter: LimitedFilteredRequest = new LimitedFilteredRequest({
                    ...selection.filter,
                    filter: transformFilter(selection.filter.filter, key),
                });

                const newSelection: TableActionSelection<T> = {
                    ...selection,
                    filter,
                    fetcher,
                    cachedAllValues: selection.cachedAllValues?.map(x => x[key] as T),
                    markedRows: new Map([...selection.markedRows.values()].map((row) => {
                        const x = row[key] as T;
                        return [x.id, x];
                    })),
                    markedRowsAreSelected: selection.markedRowsAreSelected,
                };

                return newSelection;
            },
        });
    }
}

export class MenuTableAction<T extends { id: string }> extends TableAction<T> {
    async handle(data: TableActionSelection<T>) {
        // Do nothing
    }

    _adaptToPropertyHelper<X extends { id: string }>(args: TransformTableActionArgs<X, T>): TableAction<X> {
        return new MenuTableAction<X>({
            name: this.name,
            description: this.description,
            icon: this.icon,
            priority: this.priority,
            groupIndex: this.groupIndex,
            needsSelection: this.needsSelection,
            singleSelection: this.singleSelection,
            tooltip: this.tooltip,
            enabled: this.enabled,
            allowAutoSelectAll: this.allowAutoSelectAll,
            childMenu: this.childMenu,
            destructive: this.destructive,
            childActions: this.getChildActions().map(a => a._adaptToPropertyHelper<X>(args)),
        });
    }
}

export class AsyncTableAction<T extends { id: string }> extends TableAction<T> {
    handler: (selection: TableActionSelection<T>) => Promise<void> | void;

    constructor(settings: Partial<TableAction<T>> & { handler: (selection: TableActionSelection<T>) => Promise<void> | void }) {
        super(settings);
        this.handler = settings.handler ?? (() => { throw new Error('No handler defined'); });
    }

    async handle(selection: TableActionSelection<T>) {
        // todo
        await this.handler(selection);
    }

    _adaptToPropertyHelper<X extends { id: string }>(args: TransformTableActionArgs<X, T>): TableAction<X> {
        return new AsyncTableAction<X>({
            name: this.name,
            description: this.description,
            icon: this.icon,
            priority: this.priority,
            groupIndex: this.groupIndex,
            needsSelection: this.needsSelection,
            singleSelection: this.singleSelection,
            tooltip: this.tooltip,
            enabled: this.enabled,
            allowAutoSelectAll: this.allowAutoSelectAll,
            childMenu: this.childMenu,
            destructive: this.destructive,
            childActions: this.getChildActions().map(a => a._adaptToPropertyHelper<X>(args)),
            handler: async (selection: TableActionSelection<X>) => await this.handler(args.selectionTransformer(selection)),
        });
    }
}

export class InMemoryTableAction<T extends { id: string }> extends TableAction<T> {
    handler: (item: T[]) => Promise<void> | void;

    constructor(settings: Partial<TableAction<T>> & { handler: (item: T[]) => Promise<void> | void }) {
        super(settings);
        this.handler = settings.handler ?? (() => { throw new Error('No handler defined'); });
    }

    async fetchAll(initialRequest: LimitedFilteredRequest, objectFetcher: ObjectFetcher<T>, options?: FetchAllOptions<T>) {
        return await fetchAll(initialRequest, objectFetcher, options);
    }

    async getSelection(selection: TableActionSelection<T>, options: FetchAllOptions<T>) {
        if (selection.cachedAllValues) {
            return selection.cachedAllValues;
        }

        if (selection.markedRows.size && selection.markedRowsAreSelected === true) {
            // No async needed
            return Array.from(selection.markedRows.values());
        }
        else {
            return await this.fetchAll(selection.filter, selection.fetcher, options);
        }
    }

    async handle(data: TableActionSelection<T>) {
        const toast: Toast = new Toast($t(`7b5938ef-8209-43e9-bea2-4299be757698`), 'spinner').setHide(null);
        const timer = setTimeout(() => {
            toast.show();
        }, 1000);

        try {
            const items = this.needsSelection
                ? (await this.getSelection(data, {
                        onProgress(count, total) {
                            toast.setProgress(total !== 0 ? (count / total) : 0);
                        },
                    }))
                : [];
            toast.setProgress(1);
            toast.message = $t(`13262228-81da-4b13-acb0-8a2bff210389`);
            await this.handler(items);
        }
        finally {
            clearTimeout(timer);
            toast.hide();
        }
    }

    _adaptToPropertyHelper<X extends { id: string }>(args: TransformTableActionArgs<X, T>): TableAction<X> {
        return new InMemoryTableAction<X>({
            name: this.name,
            description: this.description,
            icon: this.icon,
            priority: this.priority,
            groupIndex: this.groupIndex,
            needsSelection: this.needsSelection,
            singleSelection: this.singleSelection,
            tooltip: this.tooltip,
            enabled: this.enabled,
            allowAutoSelectAll: this.allowAutoSelectAll,
            childMenu: this.childMenu,
            destructive: this.destructive,
            childActions: this.getChildActions().map(a => a._adaptToPropertyHelper<X>(args)),
            handler: async (items: X[]) => {
                await this.handler(items.map(i => args.inMemoryTransformer(i)));
            },
        });
    }
}
