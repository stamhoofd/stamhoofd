import type { Decoder } from '@simonbackx/simple-encoding';
import { useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import type { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { BalanceItemBreakdown, BreakdownGroup, BreakdownSelection, ExcelExportType, PaymentBreakdown, StamhoofdFilter } from '@stamhoofd/structures';
import { BreakdownAmountType, BreakdownPathItem, BreakdownRequest, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';

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
     * Shown when the list that is opened holds more than the amount it was opened from.
     */
    partialListMessage: string;
    /**
     * What the amounts of this breakdown are when they are not simply what these objects are worth,
     * e.g. only what is still open of them.
     */
    amountTypeMessages: Partial<Record<BreakdownAmountType, string>>;
}) {
    const context = useContext();
    const owner = useRequestOwner();
    const errors = useErrors();
    const show = useShow();

    const breakdown = ref(null) as Ref<T | null>;
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

        try {
            await show({
                components: [
                    AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                        type: options.exportType,
                        filter: new LimitedFilteredRequest({
                            // Without a breakdown only the selection this view started from is known
                            filter: breakdown.value ? breakdown.value.selection.filter : props.filter,
                            search: props.search,
                            limit: 100,
                            sort: [
                                { key: options.exportSortKey, order: SortItemDirection.ASC },
                                { key: 'id', order: SortItemDirection.ASC },
                            ],
                        }),
                        workbook: props.getSelectableWorkbook(),
                        configurationId: props.configurationId,
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
    function getNarrowedProps({ id, name, tab }: { id: string; name: string; tab: BreakdownPathItem['tab'] }): BreakdownViewProps {
        return {
            filter: props.filter,
            search: props.search,
            title: name,
            rootTitle: props.rootTitle ?? props.title,
            path: [...(props.path ?? []), BreakdownPathItem.create({ tab, id })],
            pathNames: [...(props.pathNames ?? []), name],
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

        return options.amountTypeMessages[selection.amountType]
            ?? (selection.isListPartial ? options.partialListMessage : null);
    });

    /**
     * Whether a tab still says something. An empty tab has nothing to show, and a tab you already
     * opened a group of holds that one group and nothing else, so it only repeats the title.
     */
    function isTabVisible(tab: BreakdownPathItem['tab'], groups: BreakdownGroup[]): boolean {
        if (groups.length === 0) {
            return false;
        }

        return groups.length > 1 || !(props.path ?? []).some(step => step.tab === tab);
    }

    return { breakdown, loading, exporting, errors, canExport, canExportWithoutBreakdown, amountMessage, startExport, getNarrowedProps, openTable, isTabVisible };
}
