<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>
        <p class="style-description-small">
            {{ formatStartDate(period.startDate, false, true) }} - {{ formatEndDate(period.endDate, false, true) }}
        </p>

        <template #right>
            <span v-if="isCurrent" class="style-tag">{{ $t('1c5ba032-2132-4bda-8aae-7f622f6f3a2a') }}</span>
            <span v-if="period.locked" class="icon lock gray" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { RegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
    currentPeriodId: string;
}>();

const isCurrent = computed(() => {
    return props.period.id === props.currentPeriodId;
});
</script>
