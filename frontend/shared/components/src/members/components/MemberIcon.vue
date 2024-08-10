<template>
    <figure v-if="image" class="style-image-with-icon">
        <ImageComponent :image="image" />
        <aside>
            <span v-if="icon" class="icon gray small" :class="icon" />
        </aside>
    </figure>
    <figure v-else v-color="member.id" class="style-image-with-icon">
        <figure>
            <span>{{ member.patchedMember.details.getShortCode(2) }}</span>
        </figure>
        <aside>
            <span v-if="icon" class="icon gray small" :class="icon" />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { ImageComponent } from '@stamhoofd/components';
import { GroupType, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        member: PlatformMember;
        icon?: string;
    }>(), {
        icon: ''
    }
);

const groups = computed(() => props.member.filterGroups({currentPeriod: true, types: [GroupType.Membership]}));
const image = computed(() => groups.value.length === 1 ? (groups.value[0].settings.squarePhoto ?? groups.value[0].settings.coverPhoto) : null);

</script>
