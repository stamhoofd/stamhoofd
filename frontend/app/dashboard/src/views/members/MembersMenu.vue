<template>
    <div class="st-menu st-view members-menu">
        <STNavigationBar title="Leden" />

        <main>
            <h1>Leden</h1>

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
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate, useUrl } from '@simonbackx/vue-app-navigation';
import { GroupAvatar, useContext, useOrganization } from '@stamhoofd/components';
import { Group, GroupCategory, GroupCategoryTree } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, Ref, computed, onActivated, ref } from 'vue';
import { useCollapsed } from '../../hooks/useCollapsed';

const $organization = useOrganization();
const $context = useContext();
const currentlySelected = ref(null) as Ref<string|null>
const urlHelpers = useUrl();
const $navigate = useNavigate()
const collapsed = useCollapsed('leden');
const tree = computed(() => {
    return $organization.value!.getCategoryTree({
        permissions: $context.value?.organizationPermissions
    })
})

onActivated(() => {
    urlHelpers.setTitle('Leden');
});

const enableMemberModule = computed(() => $organization.value?.meta.modules.useMembers ?? false)
const fullAccess = computed(() => $context.value?.organizationAuth.hasFullAccess() ?? false)

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
        url: 'categorie/@slug',
        name: 'category',
        params: {
            slug: String
        },
        show: 'detail',
        component: async () => ((await import( "../dashboard/groups/CategoryView.vue")).default) as unknown as ComponentOptions,
        paramsToProps: (params: {slug: string}) => {
            const category = $organization.value?.categoryTree.categories.find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!category) {
                throw new Error('Category not found')
            }
            currentlySelected.value = 'category-'+category.id
            return {
                category
            }
        },
        propsToParams(props) {
            if (!("category" in props)) {
                throw new Error('Missing category')
            }
            currentlySelected.value = 'category-'+(props.category as GroupCategory).id
            return {
                params: {
                    slug: Formatter.slug((props.category as GroupCategory).settings.name)
                }
            }
        }
    },
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
            currentlySelected.value = 'group-'+group.id
            return {
                group
            }
        },
        propsToParams(props) {
            if (!("group" in props)) {
                throw new Error('Missing group')
            }
            currentlySelected.value = 'group-'+(props.group as Group).id
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
