<template>
    <ImageComponent v-if="image" :image="image" />
    <OrganizationAvatar v-else-if="organization && organization.meta.squareLogo" :organization="organization" />
    <figure v-else>
        <span>{{ group.settings.getShortCode(2) }}</span>
    </figure>
</template>

<script setup lang="ts">
import { ImageComponent, OrganizationAvatar } from '@stamhoofd/components';
import { Group, Organization } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        group: Group;
        organization?: Organization|null; // Optionally use organization logo if no other is available
    }>(), {
        organization: null
    }
);

const image = computed(() => props.group.settings.squarePhoto ?? props.group.settings.coverPhoto);
</script>
