<template>
    <span v-if="count !== null">{{ formatInteger(count) }}</span>
    <span v-else class="style-placeholder-skeleton" />
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { CountFilteredRequest, mergeFilters, StamhoofdFilter } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import { useRegistrationsObjectFetcher } from '../../fetchers/useRegistrationsObjectFetcher';

const props = defineProps<{
    filter: StamhoofdFilter;
}>();
const count = ref(null as null | number);
const fetcher = useRegistrationsObjectFetcher();

watch(() => JSON.stringify(props.filter), async () => {
    Request.cancelAll(fetcher);

    const response = await fetcher.fetchCount(new CountFilteredRequest({
        filter: mergeFilters([
            props.filter,
            {
                deactivatedAt: null
            },
        ]),
    }));

    count.value = response;
}, { immediate: true });

</script>
