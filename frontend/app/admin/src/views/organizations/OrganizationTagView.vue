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
                        <span class="icon group" />
                    </template>
                    <h2 class="style-title-list bolder">
                        {{ $t('919139ab-1103-4e1b-aaf7-94cfec03a9e3', { name: title }) }}
                    </h2>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
                <STListItem v-for="childTag of childTags" :key="childTag.id" :selectable="true" @click="openChildTag(childTag)">
                    <template #left>
                        <span v-if="childTag.type === OrganizationTagType.Tag" class="icon label" />
                        <span v-else class="icon location" />
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
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar, usePlatform } from '@stamhoofd/components';
import { OrganizationTag, OrganizationTagType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';
import OrganizationTagView from './OrganizationTagView.vue';

const props = defineProps<{
    tag: OrganizationTag;
}>();

const navigate = useNavigate();
const platform = usePlatform();

enum Routes {
    All = 'all',
    Tag = 'tag',
    Organizations = 'organizations',
}

defineRoutes([
    {
        url: 'groepen',
        name: Routes.All,
        component: OrganizationsTableView as unknown as ComponentOptions,
        params: {
            slug: String,
        },
        paramsToProps() {
            return {
                tag: props.tag,
            };
        },
    },
    {
        url: 'tag/@slug/groepen',
        name: Routes.Organizations,
        component: OrganizationsTableView as unknown as ComponentOptions,
        params: {
            slug: String,
        },
        paramsToProps(params: { slug: string }) {
            const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
            if (!tag) {
                throw new Error('Tag not found');
            }

            return {
                tag,
            };
        },
        propsToParams(props) {
            if (!('tag' in props) || !(props.tag instanceof OrganizationTag)) {
                throw new Error('Missing tag');
            }

            return {
                params: {
                    slug: Formatter.slug(props.tag.name),
                },
            };
        },
    },
    {
        url: 'tag/@slug',
        name: Routes.Tag,
        component: OrganizationTagView as unknown as ComponentOptions,
        params: {
            slug: String,
        },
        paramsToProps(params: { slug: string }) {
            const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
            if (!tag) {
                throw new Error('Tag not found');
            }

            return {
                tag,
            };
        },
        propsToParams(props) {
            if (!('tag' in props) || !(props.tag instanceof OrganizationTag)) {
                throw new Error('Missing tag');
            }

            return {
                params: {
                    slug: Formatter.slug(props.tag.name),
                },
            };
        },
    },

]);

const title = computed(() => props.tag.name);

const childTags = computed(() => {
    const allTags = platform.value.config.tags;
    return props.tag.childTags.map(id => allTags.find(tag => tag.id === id)).filter(x => x !== undefined);
});

const isShowTable = computed(() => childTags.value.length === 0);

async function openChildTag(tag: OrganizationTag) {
    if (tag.childTags.length > 0) {
        await navigate(Routes.Tag, { properties: { tag } });
        return;
    }
    await navigate(Routes.Organizations, { properties: { tag } });
}

async function openThisTag() {
    await navigate(Routes.All);
}
</script>

<style lang="scss">
    .category-view {
        --block-width: 24px;
    }
</style>
