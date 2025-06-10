<template>
    <div class="st-menu st-view">
        <STNavigationBar :title="$t(`edfc89fe-a16e-4789-bda9-1529f8a97f7c`)">
            <template #right>
                <button v-if="hasFullAccess" class="navigation button icon settings" type="button" @click="hasFullAccess && navigate(Routes.Tags)" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ $t("6e884f27-427f-4f85-914c-d5c2780253b0") }}</h1>

            <div class="container">
                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.All) }" @click="navigate(Routes.All)">
                    <span class="icon group" />
                    <span>
                        {{ $t("cd0975fc-75c4-4c1e-b80a-f611f0992caa") }}
                    </span>
                </button>
            </div>

            <hr><div v-for="(tag, index) in rootTags" :key="tag.id" class="container">
                <div class="grouped">
                    <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Tag, {properties: {tag}}) }" @click="navigateToTag(tag)">
                        <span v-if="tag.type === OrganizationTagType.Tag" class="icon label" />
                        <span v-else class="icon location" />

                        <span>
                            {{ tag.name }}
                        </span>
                        <span v-if="tag.childTags.length" class="button icon arrow-down-small right-icon rot" :class="{rot180: collapsed.isCollapsed(tag.id)}" @click.stop="collapsed.toggle(tag.id)" />
                    </button>

                    <div :class="{collapsable: true, hide: collapsed.isCollapsed(tag.id)}">
                        <button v-for="childTag in tagIdsToTags(tag.childTags)" :key="childTag.id" class="menu-button button sub-button" :class="{ selected: checkRoute(Routes.Tag, {properties: {tag: childTag}}) }" type="button" @click="navigateToTag(childTag)">
                            <span class="icon" />
                            <span>{{ childTag.name }}</span>
                            <span class="count">{{ formatInteger(childTag.organizationCount) }}</span>
                        </button>

                        <hr v-if="index < rootTags.length - 1 && tag.childTags.length">
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Route, defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth, usePlatform } from '@stamhoofd/components';
import { useCollapsed } from '@stamhoofd/dashboard/src/hooks/useCollapsed';
import { OrganizationTag, OrganizationTagType, PermissionLevel, TagHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';
import OrganizationTagView from './OrganizationTagView.vue';
import EditOrganizationTagsView from './tags/EditOrganizationTagsView.vue';

enum Routes {
    All = 'all',
    Tag = 'tag',
    Tags = 'tags',
    Organizations = 'organizations',
}

const auth = useAuth();
const hasFullAccess = auth.hasFullPlatformAccess();

defineRoutes([
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: OrganizationsTableView as unknown as ComponentOptions,
        isDefault: {
            properties: {},
        },
    },
    {
        url: 'tag/@slug/groepen',
        name: Routes.Organizations,
        show: 'detail',
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
        show: 'detail',
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
    ...(hasFullAccess
        ? [{
                url: 'tags',
                name: Routes.Tags,
                present: 'popup',
                component: EditOrganizationTagsView as unknown as ComponentOptions,
            } as Route<any>]
        : []),
]);

const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();
const collapsed = useCollapsed('tags');

const tags = computed(() => {
    const t = auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);
    if (t === 'all') {
        return platform.value.config.tags;
    }
    return t;
});

const rootTags = computed(() => TagHelper.getRootTags(tags.value));

function tagIdsToTags(tagIds: string[]): OrganizationTag[] {
    return tagIds.map(id => getTagById(id));
}

function getTagById(id: string): OrganizationTag {
    return tags.value.find(t => t.id === id) ?? OrganizationTag.create({ id, name: $t(`6748967b-c512-454f-9d30-a1a42e2814bc`) });
}

async function navigateToTag(tag: OrganizationTag) {
    if (tag.childTags.length === 0) {
        await navigate(Routes.Organizations, { properties: { tag } });
        return;
    }
    await navigate(Routes.Tag, { properties: { tag } });
}
</script>
