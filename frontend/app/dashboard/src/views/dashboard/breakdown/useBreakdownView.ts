import type { Decoder } from '@simonbackx/simple-encoding';
import { useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import type { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { BalanceItemBreakdown, BreakdownGroup, BreakdownSelection, BreakdownTab, ExcelExportType, PaymentBreakdown, StamhoofdFilter } from '@stamhoofd/structures';
import { BreakdownAmountType, BreakdownObjectType, BreakdownPathItem, BreakdownRequest, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, onMounted, ref, shallowRef } from 'vue';

/**
 * What a breakdown view needs to know: which objects to break down, and what to do with them when
 * they are exported.
 */
export type BreakdownViewProps = {
    /**
     * Selects the objects to break down. The same filter the Excel export uses.
     */
    filter: StamhoofdFilter;
    search?: string | null;
    title: string;
    /**
     * The title of the selection this breakdown started from, which stays the same while narrowing
     * down. Used to name the export. Defaults to the title.
     */
    rootTitle?: string | null;
    /**
     * The groups that were opened to get here.
     */
    path?: BreakdownPathItem[];
    pathNames?: string[];
    /**
     * Selects the objects the last opened group holds, so the server doesn't read the whole selection
     * again to throw most of it away (see BreakdownRequest.narrowFilter).
     */
    narrowFilter?: StamhoofdFilter;
    getSelectableWorkbook: () => SelectableWorkbook;
    configurationId: string;
};

/**
 * Everything the payments and the balance items breakdown do in the same way: load the breakdown of
 * the current selection, and export what is shown to Excel.
 */
export function useBreakdownView<T extends PaymentBreakdown | BalanceItemBreakdown>(props: BreakdownViewProps, options: {
    /**
     * The url of the endpoint that breaks these objects down, e.g. '/payments/breakdown'.
     */
    endpoint: string;
    decoder: Decoder<T>;
    exportType: ExcelExportType;
    /**
     * The column the export is sorted by, the same one the table of these objects uses.
     */
    exportSortKey: string;
    /**
     * The table that lists these objects one by one, shown when you want to see what a row is made of.
     */
    tableView: () => Promise<any>;
    /**
     * Whether a breakdown holds nothing at all, which is not something to export.
     */
    isEmpty: (breakdown: T) => boolean;
    /**
     * The export to use when a row holds only a part of the objects behind it, so the file holds
     * exactly what was added up. Leave out when that can't happen.
     */
    sliceExport?: {
        type: ExcelExportType;
        sortKey: string;
        getSelectableWorkbook: () => SelectableWorkbook;
        configurationId: string;
    };
    /**
     * Shown when the list that is opened holds more than the amount it was opened from.
     */
    partialListMessage: string;
    /**
     * Shown on the breakdown itself when its amount is only a part of the objects behind it. Which one
     * is shown depends on what the export holds, which is not the same as what the list holds.
     */
    partialAmountMessage: {
        /**
         * The export holds exactly the amount that is shown.
         */
        slice: string;
        /**
         * The export holds the whole objects, so it is worth more than the amount that is shown.
         */
        whole: string;
    };
    /**
     * What the amounts of this breakdown are when they are not simply what these objects are worth,
     * e.g. only what is still open of them.
     */
    amountTypeMessages: Partial<Record<BreakdownAmountType, string>>;
    /**
     * The ways this breakdown can be split up, in the order they are shown. A tab that holds nothing is
     * left out.
     */
    tabs: { id: BreakdownTab; name: string }[];
    /**
     * The rows of one tab.
     */
    getGroups: (breakdown: T, tab: BreakdownTab) => BreakdownGroup[];
    /**
     * This same view, shown again for one of its rows.
     */
    view: () => Promise<any>;
}) {
    const context = useContext();
    const owner = useRequestOwner();
    const errors = useErrors();
    const show = useShow();

    // Never mutated, and it holds every group with its relations plus up to a thousand graph points
    const breakdown = shallowRef(null) as Ref<T | null>;
    const loading = ref(true);
    const exporting = ref(false);
    const loadFailed = ref(false);

    /**
     * A breakdown reads every object one by one, so a selection can be too large to break down while it
     * can still be exported. Narrowing down goes through the breakdown, so this only holds for the
     * selection the user started from: without it we would export something else than what was asked.
     */
    const canExportWithoutBreakdown = computed(() => loadFailed.value && (props.path ?? []).length === 0);
    const isEmpty = computed(() => breakdown.value !== null && options.isEmpty(breakdown.value));
    const canExport = computed(() => canExportWithoutBreakdown.value || (breakdown.value !== null && !isEmpty.value));

    /**
     * Whether the export holds exactly what is shown instead of the whole objects around it, which is
     * the case for a breakdown that adds up parts of its objects.
     *
     * A search is about the objects that were read, not about their parts, so it keeps the whole
     * objects: the parts can't be searched, and dropping the search would widen the export.
     */
    const isSliceExport = computed(() => options.sliceExport !== undefined
        && !props.search
        && breakdown.value !== null
        && breakdown.value.selection.objectType === BreakdownObjectType.BalanceItemPayments);

    /**
     * The name of the selection that is shown, including the groups that were opened to get here.
     */
    const pathTitle = computed(() => (props.pathNames ?? []).join(' · ') || props.title);

    onMounted(() => {
        load().catch(console.error);
    });

    async function load() {
        loading.value = true;
        loadFailed.value = false;
        errors.errorBox = null;

        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: options.endpoint,
                decoder: options.decoder,
                query: new BreakdownRequest({
                    filter: props.filter,
                    search: props.search,
                    path: props.path,
                    narrowFilter: props.narrowFilter,
                }),
                shouldRetry: false,
                owner,
                // Reading every object of a large selection takes a while
                timeout: 5 * 60 * 1000,
            });

            breakdown.value = response.data;
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
            loadFailed.value = true;
        }

        loading.value = false;
    }

    async function startExport() {
        if (exporting.value || !canExport.value) {
            return;
        }
        exporting.value = true;

        // A breakdown that adds up parts of its objects exports those parts, so the file holds exactly
        // what was shown instead of the whole payments around it. Every other export is about whole
        // objects, which is what the list filter selects: the other one is at a level they don't have.
        const target = isSliceExport.value
            ? { ...options.sliceExport!, filter: breakdown.value!.selection.filter }
            : {
                    type: options.exportType,
                    sortKey: options.exportSortKey,
                    getSelectableWorkbook: props.getSelectableWorkbook,
                    configurationId: props.configurationId,
                    // Without a breakdown only the selection this view started from is known
                    filter: breakdown.value ? breakdown.value.selection.listFilter : props.filter,
                };

        try {
            await show({
                components: [
                    AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                        type: target.type,
                        filter: new LimitedFilteredRequest({
                            filter: target.filter,
                            search: props.search,
                            limit: 100,
                            sort: [
                                { key: target.sortKey, order: SortItemDirection.ASC },
                                { key: 'id', order: SortItemDirection.ASC },
                            ],
                        }),
                        workbook: target.getSelectableWorkbook(),
                        configurationId: target.configurationId,
                        title: [props.rootTitle ?? props.title, ...(props.pathNames ?? [])].join(' - '),
                    }),
                ],
            });
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e as Error);
        }

        exporting.value = false;
    }

    /**
     * The properties of the same view, narrowed down to one of its rows.
     */
    function getNarrowedProps(group: BreakdownGroup, tab: BreakdownPathItem['tab']): BreakdownViewProps {
        const name = group.name.toString();

        return {
            filter: props.filter,
            search: props.search,
            title: name,
            rootTitle: props.rootTitle ?? props.title,
            path: [...(props.path ?? []), BreakdownPathItem.create({ tab, id: group.id })],
            pathNames: [...(props.pathNames ?? []), name],
            // The objects of this row, which is never less than what the path keeps of them
            narrowFilter: group.selection?.listFilter ?? undefined,
            getSelectableWorkbook: props.getSelectableWorkbook,
            configurationId: props.configurationId,
        };
    }

    /**
     * Shows the objects behind a selection in a table, so you can look at what a number is made of.
     */
    async function openTable(selection: BreakdownSelection) {
        if (selection.isListPartial) {
            new Toast(options.partialListMessage, 'info').setHide(15 * 1000).show();
        }

        await show({
            components: [
                AsyncComponent(options.tableView, {
                    requiredFilter: selection.listFilter ?? selection.filter,
                    defaultSearch: props.search,
                    title: pathTitle.value,
                }),
            ],
        });
    }

    /**
     * What the amounts of this breakdown are, when that is not simply what these objects are worth or
     * when the objects behind them hold more.
     */
    const amountMessage = computed(() => {
        const selection = breakdown.value?.selection;

        if (!selection) {
            return null;
        }

        const amountTypeMessage = options.amountTypeMessages[selection.amountType];

        if (amountTypeMessage || !selection.isListPartial) {
            return amountTypeMessage ?? null;
        }

        // What the export holds is what the user is about to act on, so it decides which one to show
        return isSliceExport.value ? options.partialAmountMessage.slice : options.partialAmountMessage.whole;
    });

    function getGroups(id: BreakdownTab): BreakdownGroup[] {
        return breakdown.value ? options.getGroups(breakdown.value, id) : [];
    }

    /**
     * The tabs that still say something. An empty tab has nothing to show, and a tab you already opened
     * a group of holds that one group and nothing else, so it only repeats the title.
     */
    const tabs = computed(() => options.tabs.filter(({ id }) => {
        const groups = getGroups(id);

        if (groups.length === 0) {
            return false;
        }

        return groups.length > 1 || !(props.path ?? []).some(step => step.tab === id);
    }));

    const selectedTab = shallowRef(options.tabs[0].id) as Ref<BreakdownTab>;

    const tab = computed({
        get: () => tabs.value.find(t => t.id === selectedTab.value) ?? tabs.value[0],
        set: (value: { id: BreakdownTab; name: string }) => {
            selectedTab.value = value.id;
        },
    });

    const visibleGroups = computed(() => tab.value ? getGroups(tab.value.id) : []);

    /**
     * Whether a row that can't be opened is shown, so the view can say why.
     */
    const hasClosedGroups = computed(() => visibleGroups.value.some(group => !group.canNarrowDown && group.selection === null));

    /**
     * Opening a group breaks it down further. The articles of an order are the deepest level: there we
     * show what they are made of instead.
     */
    async function openGroup(group: BreakdownGroup) {
        if (!group.canNarrowDown) {
            if (group.selection) {
                await openTable(group.selection);
            }
            return;
        }

        await show({
            components: [
                AsyncComponent(options.view, getNarrowedProps(group, tab.value.id)),
            ],
        });
    }

    return { breakdown, loading, exporting, errors, canExport, canExportWithoutBreakdown, amountMessage, startExport, openTable, tabs, tab, visibleGroups, hasClosedGroups, openGroup };
}
