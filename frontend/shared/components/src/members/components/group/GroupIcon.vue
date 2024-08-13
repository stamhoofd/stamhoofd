<template>
    <figure v-if="image" class="style-image-with-icon">
        <ImageComponent :image="image" />
        <aside>
            <span v-if="icon" class="icon gray small" :class="icon" />
            <span v-else-if="waitingList" class="icon gray clock small" />
        </aside>
    </figure>
    <figure v-else-if="organization && organization.meta.squareLogo" class="style-image-with-icon">
        <OrganizationAvatar :organization="organization" />
        <aside>
            <span v-if="icon" class="icon gray small" :class="icon" />
            <span v-else-if="waitingList" class="icon gray clock small" />
        </aside>
    </figure>
    <figure v-else class="style-image-with-icon">
        <figure>
            <span>{{ group.settings.getShortCode(2) }}</span>
        </figure>
        <aside>
            <span v-if="icon" class="icon gray small" :class="icon" />
            <span v-else-if="waitingList" class="icon gray clock small" />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { ImageComponent, OrganizationAvatar } from '@stamhoofd/components';
import { Group, GroupType, Organization } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        group: Group;
        organization?: Organization|null; // Optionally use organization logo if no other is available
        icon?: string;
    }>(), {
        icon: '',
        organization: null
    }
);

const image = computed(() => props.group.settings.squarePhoto ?? props.group.settings.coverPhoto);
const waitingList = computed(() => props.group.type === GroupType.WaitingList);

</script>
