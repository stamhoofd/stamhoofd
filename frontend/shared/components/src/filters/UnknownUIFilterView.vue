<template>
    <code class="style-code">
        {{ encodedJson }}
    </code>
</template>


<script lang="ts" setup>
import { UnknownUIFilter } from './UnknownUIFilter';

const props = defineProps<{
    filter: UnknownUIFilter
}>()

const encodedJson = JSON.stringify(
    props.filter.value,
    null,
    4
)
</script>
