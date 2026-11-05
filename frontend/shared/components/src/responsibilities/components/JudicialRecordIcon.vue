<template>
    <img
        v-if="minimumAge !== null"
        v-tooltip="$t('Leden met deze functie die {age} of ouder zijn, moeten om de 3 jaar een uittreksel uit het strafregister (model 596.2) laten controleren', {age: Formatter.integer(minimumAge)})"
        src="@stamhoofd/assets/images/illustrations/privacy-policy.svg"
        class="style-illustration-img"
        :alt="$t('Uittreksel uit het strafregister vereist')"
    >
</template>

<script lang="ts" setup>
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    /** `judicialRecordMinimumAge` of the responsibility, null when it never asks for an extract. */
    minimumAge: number | null;
}>();
</script>
