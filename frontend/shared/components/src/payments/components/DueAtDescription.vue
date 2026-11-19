<template>
    <p v-if="visibleFrom" class="style-description-small">
        <template v-if="visibleFrom <= now">
            {{ $t('Wordt onmiddellijk zichtbaar als openstaand bedrag.') }}
        </template>
        <template v-else>
            {{ $t('Wordt pas zichtbaar als openstaand bedrag vanaf {date}.', {date: formatDate(visibleFrom, true)}) }}
        </template>
    </p>
</template>

<script lang="ts" setup>
import { BalanceItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = defineProps<{
    dueAt: Date | null;
}>();

const now = new Date();

const visibleFrom = computed(() => {
    if (!props.dueAt) {
        return null;
    }
    return Formatter.luxon(props.dueAt).minus({ days: BalanceItem.dueOffsetDays }).startOf('day').toJSDate();
});
</script>
