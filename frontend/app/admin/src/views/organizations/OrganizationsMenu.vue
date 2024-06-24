<template>
    <div class="st-menu st-view">
        <STNavigationBar title="Groepen" />

        <main>
            <h1>Groepen</h1>

            <div class="container">
                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.All) }" @click="navigate(Routes.All)">
                    <span class="icon group" />
                    <span>
                        Alle groepen
                    </span>
                </button>
            </div>

            <hr>

            <div class="container">
                <component :is="hasFullAccess ? 'button' : 'p'" type="button" class="menu-button" :class="{ button: hasFullAccess, selected: hasFullAccess && checkRoute(Routes.Tags) }" @click="hasFullAccess && navigate(Routes.Tags)">
                    <span class="icon label" />
                    <span>
                        Tags
                    </span>
                    <span v-if="hasFullAccess" class="icon gray settings right-icon" />
                </component>

                <button v-for="tag of tags" :key="tag.id" type="button" class="button menu-button sub-button" :class="{ selected: checkRoute(Routes.Tag, { properties: {tag} }) }" @click="navigate(Routes.Tag, { properties: {tag} })">
                    <span class="icon" />
                    <span>
                        {{ tag.name }}
                    </span>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Route, defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth, usePlatform } from '@stamhoofd/components';
import { OrganizationTag, PermissionLevel } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';
import EditOrganizationTagsView from './tags/EditOrganizationTagsView.vue';

enum Routes {
    All = 'all',
    Tag = 'tag',
    Tags = 'tags'
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
            properties: {}
        }
    },
    {
        url: 'tag/@slug',
        name: Routes.Tag,
        show: 'detail',
        component: OrganizationsTableView as unknown as ComponentOptions,
        params: {
            slug: String
        },
        paramsToProps(params: {slug: string}) {
            const tag = platform.value.config.tags.find(t => Formatter.slug(t.name) === params.slug);
            if (!tag) {
                throw new Error('Tag not found');
            }

            return {
                tag
            }
        },
        propsToParams(props) {
            if (!("tag" in props) || !(props.tag instanceof OrganizationTag)) {
                throw new Error('Missing tag')
            }
            return {
                params: {
                    slug: Formatter.slug(props.tag.name)
                }
            }
        },
    },
    ...(hasFullAccess ? [{
        url: 'tags',
        name: Routes.Tags,
        present: 'popup',
        component: EditOrganizationTagsView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    } as Route<any, undefined>] : [])
])
const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();

const tags = computed(() => {
    const t = auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);
    if (t === 'all') {
        return platform.value.config.tags;
    }
    return t;
});

</script>
