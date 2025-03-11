<template>
    <ChargeView :filter="filter" :type="'member'" />
</template>

<script lang="ts" setup>
import ChargeView from '@stamhoofd/components/src/views/ChargeView.vue';
import { StamhoofdFilter } from '@stamhoofd/structures';

defineProps<{ filter: StamhoofdFilter }>();
</script>
