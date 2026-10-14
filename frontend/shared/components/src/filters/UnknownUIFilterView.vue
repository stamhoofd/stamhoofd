<template>
    <code class="style-code">
        {{ encodedJson }}
    </code>
</template>


<script lang="ts" setup>
import type { UnknownUIFilterData } from './UnknownUIFilterData';

const props = defineProps<{
    filter: UnknownUIFilterData
}>()

const encodedJson = JSON.stringify(
    props.filter.value,
    null,
    4
)
</script>
