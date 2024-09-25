<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ policy.name }}
        </h2>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformPolicy } from '@stamhoofd/structures';

defineProps<{
    policy: PlatformPolicy;
}>();

</script>
