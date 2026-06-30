<template>
    <template v-for="tag in tags" :key="tag.title">
        <span :class="['style-tag', tag.style]">
            <span v-if="tag.icon" :class="['icon', tag.icon, 'text-size']" />
            <span>{{ tag.title }}</span>
        </span>
    </template>
</template>

<script setup lang="ts">
import { useAppContext } from '#context/appContext.ts';
import { useNow } from '#hooks/useNow.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import type { Group } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    group: Group;
}>();

const now = useNow();
const app = useAppContext();
const organization = useOrganization();
const tags = computed(() => props.group.getTags({ now: now.value, app, blockCreatingNewMembers: organization.value?.meta.blockCreatingNewMembers }));
</script>
