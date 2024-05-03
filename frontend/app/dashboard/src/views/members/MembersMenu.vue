<template>
    <div class="st-menu st-view members-menu">
        <main ref="main" class="sticky-navigation-bar">
            <STNavigationBar title="Leden"></STNavigationBar>

            <button v-if="!enableMemberModule" type="button" class="menu-button button cta" @click="openSignupSelection()">
                <span class="icon flag" />
                <span>Proefperiode starten</span>
            </button>

            <button v-if="enableMemberModule && tree.getAllGroups().length == 0 && fullAccess" type="button" class="menu-button button cta" @click="manageGroups(true)">
                <span class="icon settings" />
                <span>Ledenadministratie</span>
            </button>


            <template v-if="enableMemberModule && tree.categories.length">
                <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                    <div class="grouped">
                        <button class="menu-button button" type="button" :class="{ selected: currentlySelected == 'category-'+category.id }" @click="$navigate('category', {properties: {category}})">
                            <span :class="'icon ' + getCategoryIcon(category)" />
                            <span>{{ category.settings.name }}</span>
                            <span v-if="isCategoryDeactivated(category)" v-tooltip="'Deze categorie is onzichtbaar voor leden omdat activiteiten niet geactiveerd is'" class="icon error red right-icon" />
                            <span v-else-if="category.groups.length || category.categories.length" class="button icon arrow-down-small right-icon rot" :class="{rot180: collapsed.isCollapsed(category.id)}" @click.stop="collapsed.toggle(category.id)" />
                        </button>

                        <div :class="{collapsable: true, hide: collapsed.isCollapsed(category.id) || isCategoryDeactivated(category)}">
                            <button
                                v-for="c in category.categories"
                                :key="c.id"
                                class="menu-button button sub-button"
                                :class="{ selected: currentlySelected == 'category-'+c.id }"
                                type="button"
                                @click="$navigate('category', {properties: {category: c}})"
                            >
                                <span class="icon" />
                                <span>{{ c.settings.name }}</span>
                            </button>

                            <button
                                v-for="group in category.groups"
                                :key="group.id"
                                class="menu-button button sub-button"
                                :class="{ selected: currentlySelected == 'group-'+group.id }"
                                type="button"
                                @click="$navigate('group', {properties: {group}})"
                            >
                                <GroupAvatar :group="group" :allow-empty="true" />
                                <span>{{ group.settings.name }}</span>
                                <span v-if="group.settings.registeredMembers !== null" class="count">{{ group.settings.registeredMembers }}</span>
                            </button>

                            <hr v-if="index < tree.categories.length - 1">
                        </div>
                    </div>
                </div>
            </template>

            <hr>

            <button v-if="enableMemberModule && fullAccess" type="button" class="menu-button button" :class="{ selected: currentlySelected == 'member-archive'}" @click="$navigate('archive')"> 
                <span class="icon archive" />
                <span>Archief</span>
            </button>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentOptions, computed, onActivated } from 'vue';
import { Route, defineRoutes, useNavigate, useUrl } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, useOrganization, useUser } from '@stamhoofd/components';
import {Group, GroupCategoryTree, Permissions} from '@stamhoofd/structures'
import { useCollapsed } from '../../hooks/useCollapsed';
import { Formatter } from '@stamhoofd/utility';

const $organization = useOrganization();
const $user = useUser();
const currentlySelected: string = ''; // todo
const urlHelpers = useUrl();
const $navigate = useNavigate()
const collapsed = useCollapsed('leden');
const tree = computed(() => {
    return $organization.value!.getCategoryTree({
        permissions: $user.value?.permissions ?? Permissions.create({})
    })
})

onActivated(() => {
    urlHelpers.setTitle('Leden');
});

const enableMemberModule = computed(() => $organization.value?.meta.modules.useMembers ?? false)
const fullAccess = computed(() => $user.value?.permissions?.hasFullAccess($organization.value?.privateMeta?.roles ?? []) ?? false)

const getCategoryIcon = (category: GroupCategoryTree) => {
    if (category.settings.name.toLocaleLowerCase().includes('lessen') || category.settings.name.toLocaleLowerCase().includes('proefles')) {
        return "education"
    }

    if (category.settings.name.toLocaleLowerCase().includes('activiteiten') || category.settings.name.toLocaleLowerCase().includes('kamp') || category.settings.name.toLocaleLowerCase().includes('weekend')) {
        return "flag"
    }

    if (category.settings.name.toLocaleLowerCase().includes('betaling')) {
        return "card"
    }

    if (category.categories.length) {
        return "category"
    }

    return "group"
}

const isCategoryDeactivated = (category: GroupCategoryTree) => {
    return $organization.value!.isCategoryDeactivated(category)
}

defineRoutes([
    {
        url: '@slug',
        name: 'group',
        params: {
            slug: String
        },
        show: 'detail',
        component: async () => ((await import( "../dashboard/groups/GroupOverview.vue")).default) as unknown as ComponentOptions,
        paramsToProps: (params: {slug: string}) => {
            const group = $organization.value?.groups.find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!group) {
                throw new Error('Group not found')
            }
            return {
                group
            }
        },
        propsToParams(props) {
            if (!("group" in props)) {
                throw new Error('Missing group')
            }
            return {
                params: {
                    slug: Formatter.slug((props.group as Group).settings.name)
                }
            }
        },
        isDefault: {
            properties: {
                group: tree.value.getAllGroups()[0]
            }
        }
    }
])

</script>