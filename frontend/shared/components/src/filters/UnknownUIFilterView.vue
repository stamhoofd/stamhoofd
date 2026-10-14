<template>
    <code class="style-code">
        {{ encodedJson }}
    </code>
</template>


<script lang="ts" setup>
import type { StamhoofdFilter } from '@stamhoofd/structures';

const props = defineProps<{
    filter: { value: StamhoofdFilter }
}>()

const encodedJson = JSON.stringify(
    props.filter.value,
    null,
    4
)
</script>
