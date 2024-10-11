<template>
    <OrganizationsTableView v-if="isShowTable" :tag="tag" />
    <div v-else class="st-view background category-view">
        <STNavigationBar :title="title" />
        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>
            <STList>
                <STListItem :selectable="true" @click="openThisTag">
                    <template #left>
                        <span class="icon group gray" />
                    </template>
                    <!-- todo: translate -->
                    <h2 class="style-title-list bolder">
                        Alle verenigingen in {{ tag.name }}
                    </h2>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
                <STListItem v-for="childTag of childTags" :key="childTag.id" :selectable="true" @click="openChildTag(childTag)">
                    <template #left>
                        <span class="icon label gray" />
                    </template>
                    <h3 class="style-title-list">
                        {{ childTag.name }}
                    </h3>
                    <template #right>
                        <span v-if="childTag.childTags.length > 0" class="style-description-small">{{ childTag.childTags.length }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar, usePlatform } from '@stamhoofd/components';
import { OrganizationTag } from '@stamhoofd/structures';
import { computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';
import OrganizationTagView from './OrganizationTagView.vue';

const props = defineProps<{
    tag: OrganizationTag;
}>();

const show = useShow();
const platform = usePlatform();

const title = computed(() => props.tag.name);

const childTags = computed(() => {
    const allTags = platform.value.config.tags;
    return props.tag.childTags.map(id => allTags.find(tag => tag.id === id)).filter(x => x !== undefined);
});

const isShowTable = computed(() => childTags.value.length === 0);

async function openChildTag(tag: OrganizationTag) {
    await show(new ComponentWithProperties(OrganizationTagView, {
        tag,
    }));
}

async function openThisTag() {
    await show(new ComponentWithProperties(OrganizationsTableView, {
        tag: props.tag,
    }));
}
</script>

<style lang="scss">
    .category-view {
        --block-width: 24px;
    }
</style>
