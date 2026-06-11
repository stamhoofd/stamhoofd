<template>
    <div class="group-tree">
        <component :is="'h'+level" v-if="level > 0 && category.settings.name.length > 0">
            {{ category.settings.name }}
        </component>

        <div v-if="category.groups.length > 0" class="group-grid">
            <GroupBox v-for="group in category.groups" :key="group.id" :group="group" />
        </div>
        <GroupTree v-for="(c, index) in category.categories" v-else :key="c.id" :category="c" :parent-level="level" :is-last="index >= category.categories.length - 1" />
        <hr v-if="category.groups.length > 0 && !isLast">
    </div>
</template>

<script setup lang="ts">
import type { GroupCategoryTree } from '@stamhoofd/structures';
import { computed } from 'vue';

import GroupBox from './GroupBox.vue';

defineOptions({ name: 'GroupTree' }); // required for recursive component + minification of vue

const props = withDefaults(defineProps<{
    category: GroupCategoryTree;
    isLast?: boolean;
    parentLevel?: number;
}>(), {
    isLast: true,
    parentLevel: -1,
});

const level = computed(() => Math.min(props.parentLevel + 1, 2));
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-tree {
    padding-bottom: 20px;

    > h1 {
        padding-bottom: 15px;
        @extend .style-title-1;
    }

    > h2 {
        padding-bottom: 15px;
        @extend .style-title-2;
    }

    > p:not([class]) {
        @extend .style-description;
        padding-bottom: 40px;
    }

    > hr {
        @extend .style-hr;
    }

}
.group-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding-bottom: 20px;

    @media (max-width: 800px) {
        gap: 0;
        grid-template-columns: 1fr;

        > * {
            margin-bottom: 10px;
        }
    }
}

</style>
