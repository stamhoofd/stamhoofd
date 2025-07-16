<template>
    <Dropdown :model-value="props.modelValue.id" :disabled="isSinglePeriod" @update:model-value="onUpdate($event)">
        <option v-if="isSinglePeriod" :value="periods[0].id">
            {{ $t('82d2825a-998b-4c0d-b109-f78ccc8d376f') }}
        </option>
        <template v-else>
            <option v-for="period in periods" :key="period.id" :value="period.id" :disabled="shouldDisableLockedPeriods && period.period.locked">
                {{ period.period.name }}
            </option>
        </template>
    </Dropdown>
</template>

<script setup lang="ts">
import { Dropdown } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
const props = withDefaults(defineProps<{ modelValue: OrganizationRegistrationPeriod; shouldDisableLockedPeriods?: boolean }>(), {
    shouldDisableLockedPeriods: false,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: OrganizationRegistrationPeriod | null): void }>();

const organizationManager = useOrganizationManager();
const owner = useRequestOwner();

// Load groups
organizationManager.value.loadPeriods(false, false, owner).catch(console.error);

const periods = computed(() => {
    const periods = organizationManager.value.organization.periods?.organizationPeriods;
    if (periods === undefined) {
        return [organizationManager.value.organization.period];
    }

    const periodsCopy = [...periods];

    periodsCopy.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));

    return periodsCopy;
});

const isSinglePeriod = computed(() => periods.value.length === 1);

function onUpdate(id: string) {
    const period = periods.value.find(p => p.id === id);
    if (period) {
        emit('update:modelValue', period);
    }
}
</script>
