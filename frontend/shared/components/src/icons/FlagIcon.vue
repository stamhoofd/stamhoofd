<template>
    <img src="@stamhoofd/assets/images/flags/nl.svg" class="icon">
</template>

<script setup lang="ts">
import type { CountryCode } from '@stamhoofd/types/Country';
import type { Language } from '@stamhoofd/types/Language';

withDefaults(
    defineProps<{
        language: Language;
        country?: CountryCode | null;
    }>(), {
        country: null,
    },
);
</script>
