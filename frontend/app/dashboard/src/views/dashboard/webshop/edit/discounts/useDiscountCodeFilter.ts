import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { GroupUIFilterBuilder } from '@stamhoofd/components/filters/GroupUIFilter.ts';
import { NumberFilterBuilder } from '@stamhoofd/components/filters/NumberUIFilter.ts';
import { StringFilterBuilder } from '@stamhoofd/components/filters/StringUIFilter.ts';
import type { UIFilter, UIFilterBuilders } from '@stamhoofd/components/filters/UIFilter.ts';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet';
import type { DiscountCode, InMemoryFilterDefinitions } from '@stamhoofd/structures';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, isEmptyFilter } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

// In-memory filter compilers for the (only) filterable discount code properties.
const discountCodeInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    code: createInMemoryFilterCompiler('code'),
    usageCount: createInMemoryFilterCompiler('usageCount'),
};

function getDiscountCodeUIFilterBuilders(): UIFilterBuilders {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t('Code'),
            key: 'code',
        }),
        new NumberFilterBuilder({
            name: $t('Aantal keer gebruikt'),
            key: 'usageCount',
        }),
    ];

    builders.unshift(
        new GroupUIFilterBuilder({ builders }),
    );

    return builders;
}

/**
 * Shared search + advanced filter logic for discount code lists. Combines a free text search (code or
 * description) with an in-memory UI filter on the code and usage count.
 */
export function useDiscountCodeFilter() {
    const { presentPositionableSheet } = usePositionableSheet();

    const searchQuery = ref('');
    const filterBuilders = getDiscountCodeUIFilterBuilders();
    const selectedUIFilter = ref(null) as Ref<UIFilter | null>;

    // A single predicate that combines the search query and the advanced filter.
    const matcher = computed(() => {
        const query = searchQuery.value.trim().toLowerCase();
        const filter = selectedUIFilter.value?.build() ?? null;
        const compiledFilter = filter ? compileToInMemoryFilter(filter, discountCodeInMemoryFilterCompilers) : null;

        return (code: DiscountCode) => {
            if (query && !code.code.toLowerCase().includes(query) && !code.description.toLowerCase().includes(query)) {
                return false;
            }
            if (compiledFilter && !compiledFilter(code)) {
                return false;
            }
            return true;
        };
    });

    // Whether the advanced filter (the filter button) is currently narrowing the list.
    const hasActiveFilter = computed(() => {
        const filter = selectedUIFilter.value?.build() ?? null;
        return filter !== null && !isEmptyFilter(filter);
    });

    // Whether a search query or advanced filter is currently narrowing the list.
    const isFiltering = computed(() => searchQuery.value.trim().length > 0 || hasActiveFilter.value);

    function filterCodes(codes: DiscountCode[]): DiscountCode[] {
        return codes.filter(matcher.value);
    }

    async function editFilter(event: MouseEvent) {
        const filter = selectedUIFilter.value ?? filterBuilders[0].create();
        if (!selectedUIFilter.value) {
            selectedUIFilter.value = filter;
        }

        await presentPositionableSheet(event, {
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('@stamhoofd/components/filters/UIFilterEditor.vue'), {
                        filter,
                    }),
                }),
            ],
        });
    }

    return {
        searchQuery,
        selectedUIFilter,
        filterBuilders,
        hasActiveFilter,
        isFiltering,
        filterCodes,
        editFilter,
    };
}
