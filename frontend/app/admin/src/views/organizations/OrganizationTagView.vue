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
                        {{ $t('%7X', { name: title }) }}
                    </h2>
                    <template #right>
                        <span class="style-description-small">{{ tag.organizationCount }}</span>
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
                    <p v-if="childTag.description" class="style-description-small pre-wrap style-limit-lines" v-text="childTag.description" />

                    <template #right>
                        <span v-if="childTag.childTags.length > 0" class="style-description-small">{{ childTag.childTags.length }}</span>
                        <span v-else class="style-description-small">{{ childTag.organizationCount }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { OrganizationTag } from '@stamhoofd/structures';
import { OrganizationTagType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';

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

defineRoute({
    url: 'groepen',
    name: Routes.All,
    component: OrganizationsTableView,
    defaultProperties() {
        return {
            tag: props.tag,
        };
    },
});

defineRoute({
    url: 'tag/@slug/groepen',
    name: Routes.Organizations,
    component: OrganizationsTableView,
    params: {
        slug: String,
    },
    paramsToProps(params) {
        const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
        if (!tag) {
            throw new Error('Tag not found');
        }

        return {
            tag,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.tag.name),
            },
        };
    },
});

defineRoute({
    url: 'tag/@slug',
    name: Routes.Tag,
    component: async () => (await import('./OrganizationTagView.vue')).default,
    params: {
        slug: String,
    },
    paramsToProps(params) {
        const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
        if (!tag) {
            throw new Error('Tag not found');
        }

        return {
            tag,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.tag.name),
            },
        };
    },
});

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
