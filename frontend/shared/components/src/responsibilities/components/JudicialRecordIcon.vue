<template>
    <img
        v-if="minimumAge !== null && hasJudicialRecord"
        v-tooltip="$t('Leden met deze functie die {age} of ouder zijn, moeten om de 3 jaar een uittreksel uit het strafregister (model 596.2) laten controleren', {age: Formatter.integer(minimumAge)})"
        src="@stamhoofd/assets/images/illustrations/privacy-policy.svg"
        class="style-illustration-img"
        :alt="$t('Uittreksel uit het strafregister vereist')"
    >
</template>

<script lang="ts" setup>
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { hasJudicialRecordFeature } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

defineProps<{
    /** `judicialRecordMinimumAge` of the responsibility, null when it never asks for an extract. */
    minimumAge: number | null;
}>();

const platform = usePlatform();
const organization = useOrganization();

const hasJudicialRecord = computed(() => hasJudicialRecordFeature({ platform: platform.value, organization: organization.value }));
</script>
