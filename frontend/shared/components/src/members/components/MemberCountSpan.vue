<template>
    <span v-if="count !== null">{{ formatInteger(count) }}</span>
    <span v-else class="style-placeholder-skeleton" />
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import { useMembersObjectFetcher } from '../../fetchers';

const props = defineProps<{
    filter: StamhoofdFilter;
}>();
const count = ref(null as null | number);
const fetcher = useMembersObjectFetcher();

watch(() => JSON.stringify(props.filter), async () => {
    Request.cancelAll(fetcher);

    const response = await fetcher.fetchCount(new CountFilteredRequest({
        filter: props.filter,
    }));

    count.value = response;
}, { immediate: true });

</script>
