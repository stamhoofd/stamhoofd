<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>
        <p class="style-description-small">
            {{ formatDate(period.startDate, true) }} - {{ formatDate(period.endDate, true) }}
        </p>

        <template #right>
            <span v-if="isCurrent" class="style-tag">Huidige</span>
            <span v-if="period.locked" class="icon lock gray" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { Platform, RegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod,
    platform: Platform
}>();

const isCurrent = computed(() => {
    return props.period.id === props.platform.period.id;
})
</script>
