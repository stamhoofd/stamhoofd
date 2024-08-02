<template>
    <figure v-if="image" class="style-image-with-icon">
        <ImageComponent :image="image" />
        <aside>
            <span v-if="waitingList" class="icon gray clock small" />
        </aside>
    </figure>
    <figure v-else class="style-image-with-icon">
        <figure>
            <span>{{ group.settings.getShortCode(2) }}</span>
        </figure>
        <aside>
            <span v-if="waitingList" class="icon gray clock small" />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { ImageComponent } from '@stamhoofd/components';
import { Group, GroupType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        group: Group;
    }>(), {
    }
);

const image = computed(() => props.group.settings.squarePhoto ?? props.group.settings.coverPhoto);
const waitingList = computed(() => props.group.type === GroupType.WaitingList);

</script>
