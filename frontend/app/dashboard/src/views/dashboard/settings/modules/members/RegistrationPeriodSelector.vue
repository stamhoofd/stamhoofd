<template>
    <Dropdown :model-value="props.modelValue.id" :disabled="isSinglePeriod" @update:model-value="onUpdate($event)">
        <option v-if="isSinglePeriod" :value="periods[0].id">
            {{ $t('%1AG') }}
        </option>
        <template v-else>
            <option v-for="period in periods" :key="period.id" :value="period.id" :disabled="shouldDisableLockedPeriods && period.period.locked">
                {{ period.period.name }}
            </option>
        </template>
    </Dropdown>
</template>

<script setup lang="ts">
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
const props = withDefaults(defineProps<{ modelValue: OrganizationRegistrationPeriod; shouldDisableLockedPeriods?: boolean }>(), {
    shouldDisableLockedPeriods: false,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: OrganizationRegistrationPeriod | null): void }>();

const organization = useRequiredOrganization();
const fetchPeriods = useFetchOrganizationRegistrationPeriods();
const fetchedPeriods = ref(null) as Ref<OrganizationRegistrationPeriod[] | null>;

fetchPeriods({ shouldRetry: false }).then((list) => {
    fetchedPeriods.value = list.organizationPeriods;
}).catch(console.error);

const periods = computed(() => fetchedPeriods.value ?? [organization.value.period]);

const isSinglePeriod = computed(() => periods.value.length === 1);

function onUpdate(id: string) {
    const period = periods.value.find(p => p.id === id);
    if (period) {
        emit('update:modelValue', period);
    }
}
</script>
