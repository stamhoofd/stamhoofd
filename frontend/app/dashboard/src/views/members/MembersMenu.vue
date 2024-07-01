<template>
    <div class="st-menu st-view members-menu">
        <STNavigationBar title="Leden" />

        <main>
            <h1>Leden</h1>

            <button v-if="canUpgradePeriod" type="button" class="menu-button button cta">
                <span class="icon flag" />
                <span>Schakel over naar {{ newestPeriod.name }}</span>
            </button>

            <p class="info-box" v-if="tree.categories.length === 0">Oeps, er zijn nog geen inschrijvingsgroepen gemaakt. Ga naar de instellingen en configureer jouw inschrijvingsgroepen.</p>

            <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                <div class="grouped">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Category, {properties: {category, period}}) }" @click="$navigate('category', {properties: {category, period}})">
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
                            :class="{ selected: checkRoute(Routes.Category, {properties: {category: c, period}}) }"
                            type="button"
                            @click="$navigate(Routes.Category, {properties: {category: c, period}})"
                        >
                            <span class="icon" />
                            <span>{{ c.settings.name }}</span>
                        </button>

                        <button
                            v-for="group in category.groups"
                            :key="group.id"
                            class="menu-button button sub-button"
                            :class="{ selected: checkRoute(Routes.Group, {properties: {group, period}}) }"
                            type="button"
                            @click="$navigate(Routes.Group, {properties: {group, period}})"
                        >
                            <GroupAvatar :group="group" :allow-empty="true" />
                            <span>{{ group.settings.name }}</span>
                            <span v-if="group.settings.registeredMembers !== null" class="count">{{ formatInteger(group.settings.registeredMembers) }}</span>
                        </button>

                        <hr v-if="index < tree.categories.length - 1">
                    </div>
                </div>
            </div>

            <div class="grouped footer">
                <hr>

                <button class="menu-button button" type="button" @click="switchPeriod">
                    <span>{{ period.period.name }}</span>
                    <span class="icon gray arrow-swap right-icon" />
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate, useUrl } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, GroupAvatar, useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { Group, GroupCategory, GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, Ref, computed, onActivated, ref } from 'vue';
import { useCollapsed } from '../../hooks/useCollapsed';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';

const $organization = useOrganization();
const $context = useContext();
const urlHelpers = useUrl();
const $navigate = useNavigate()
const collapsed = useCollapsed('leden');
const platform = usePlatform();
const organizationManager = useOrganizationManager()
const owner = useRequestOwner();

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: $context.value?.organizationPermissions,
        organization: $organization.value!
    })
})
const period = computed(() => $organization.value?.period) as Ref<OrganizationRegistrationPeriod>
const newestPeriod = computed(() => {
    return platform.value.period
})
const canUpgradePeriod = computed(() => {
    return $organization.value?.period.period.id !== platform.value.period.id
})

onActivated(() => {
    urlHelpers.setTitle('Leden');
});

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

enum Routes {
    Category = "category",
    Group = "group"
}
defineRoutes([
    {
        url: 'categorie/@slug',
        name: Routes.Category,
        params: {
            slug: String
        },
        show: 'detail',
        component: async () => ((await import( "../dashboard/groups/CategoryView.vue")).default) as unknown as ComponentOptions,
        paramsToProps: (params: {slug: string}) => {
            const category = tree.value.getAllCategories().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!category) {
                throw new Error('Category not found')
            }
            return {
                category,
                period: period.value
            }
        },
        propsToParams(props) {
            if (!("category" in props)) {
                throw new Error('Missing category')
            }
            return {
                params: {
                    slug: Formatter.slug((props.category as GroupCategory).settings.name)
                }
            }
        }
    },
    {
        url: '@slug',
        name: Routes.Group,
        params: {
            slug: String
        },
        show: 'detail',
        component: async () => ((await import( "../dashboard/groups/GroupOverview.vue")).default) as unknown as ComponentOptions,
        paramsToProps: (params: {slug: string}) => {
            const group = tree.value.getAllGroups().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!group) {
                throw new Error('Group not found')
            }
            return {
                group,
                period: period.value
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
        isDefault: tree.value.getAllGroups().length ? {
            properties: {
                group: tree.value.getAllGroups()[0],
                period: period.value
            }
        } : undefined
    }
])
const checkRoute = useCheckRoute();

async function switchPeriod(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;

    // Load groups
    const list = await organizationManager.value.loadPeriods(false, false, owner);

    const menu = new ContextMenu([
        (list.periods ?? []).map(p => {
            return new ContextMenuItem({
                name: p.name,
                selected: p.id === period.value.period.id,
                icon: p.id === platform.value.period.id && p.id !== period.value.period.id ? 'dot' : '',
                action: () => {
                    if (!list.organizationPeriods.find(o => o.period.id === p.id)) {
                        // Can not start if ended, or if not stargin withing 2 months
                        if (p.endDate < new Date()) {
                            new CenteredMessage('Niet beschikbaar', 'Deze periode is niet beschikbaar voor jouw organisatie.').addCloseButton().show()
                            return false;
                        }

                        if (p.startDate.getTime() > new Date().getTime() + 1000 * 60 * 60 * 24 * 62) {
                            new CenteredMessage('Niet beschikbaar', 'Je kan pas 2 maand voor de start van het nieuwe werkjaar overschakelen.').addCloseButton().show()
                            return false;
                        }

                        new CenteredMessage('Start nieuw werkjaar', 'Je hebt dit werkjaar nog niet geconfigureerd. Ga naar de instellingen om dit te doen.').addCloseButton().show()
                    }
                    return true;
                }
            });
        })
    ])
    menu.show({ button, yOffset: -10 }).catch(console.error)
}
</script>
