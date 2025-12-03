<template>
    <div class="st-menu st-view members-menu">
        <STNavigationBar :title="$t(`6e958518-8f12-4e1b-b3af-c7d7cd0afbb6`)">
            <template #right>
                <button v-if="$canEdit" class="button icon settings" type="button" @click="editMe" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ $t('97dc1e85-339a-4153-9413-cca69959d731') }}</h1>

            <template v-if="auth.hasFullAccess()">
                <button v-if="canUpgradePeriod" type="button" class="menu-button button cta" @click="upgradePeriod">
                    <span class="icon flag" />
                    <span>{{ $t('33a6805e-a4f3-44ca-bd10-f26bc1664963', {'werkjaar-2025-2026': newestPeriod.name}) }}</span>
                </button>
                <button v-else-if="canSetDefaultPeriod" type="button" class="menu-button button cta" @click="setDefaultPeriod">
                    <span class="icon flag" />
                    <span>{{ $t('410f13a0-286d-4f7a-b6f6-aef22327056b') }}</span>
                </button>
                <div v-else-if="period.id !== $organization.period.id" class="info-box">
                    {{ $t('b2e0df73-bf2c-421c-8feb-7bec5fe7d8c1') }}
                </div>

                <hr v-if="canUpgradePeriod || canSetDefaultPeriod">
            </template>

            <p v-if="tree.categories.length === 0" class="info-box">
                {{ $t('0289e748-906d-453a-b54f-dce6a0355da0') }}
            </p>

            <div v-if="showAll" class="container">
                <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                    <span class="icon ul" />
                    <span>{{ $t('379d43fb-034f-4280-bb99-ea658eaec729') }}</span>
                </button>
            </div>
            <hr v-if="showAll">
            <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                <div class="grouped">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Category, {properties: {category, period}}) }" @click="$navigate('category', {properties: {category, period}})">
                        <span :class="'icon ' + getCategoryIcon(category)" />
                        <span>{{ category.settings.name }}</span>
                        <span v-if="isCategoryDeactivated(category)" class="icon error red right-icon" :v-tooltip="$t('24b0cf4b-a0be-4d8c-bd75-c04648cdf570')" />
                        <span v-else-if="category.groups.length || category.categories.length" class="button icon arrow-down-small right-icon rot" :class="{rot180: collapsed.isCollapsed(category.id)}" @click.stop="collapsed.toggle(category.id)" />
                    </button>

                    <div :class="{collapsable: true, hide: collapsed.isCollapsed(category.id) || isCategoryDeactivated(category)}">
                        <button v-for="c in category.categories" :key="c.id" class="menu-button button sub-button" :class="{ selected: checkRoute(Routes.Category, {properties: {category: c, period}}) }" type="button" @click="$navigate(Routes.Category, {properties: {category: c, period}})">
                            <span class="icon" />
                            <span>{{ c.settings.name }}</span>
                        </button>

                        <button v-for="group in category.groups" :key="group.id" class="menu-button button sub-button" :class="{ selected: checkRoute(Routes.Group, {properties: {group, period}}) }" type="button" @click="$navigate(Routes.Group, {properties: {group, period}})">
                            <GroupAvatar :group="group" :allow-empty="true" />
                            <span>{{ group.settings.name }}</span>
                            <span v-if="group.settings.registeredMembers !== null" class="count">{{ formatInteger(group.settings.registeredMembers) }}</span>
                        </button>

                        <hr v-if="index < tree.categories.length - 1">
                    </div>
                </div>
            </div>

            <div v-if="auth.hasFullAccess()" class="grouped footer">
                <hr><button class="menu-button button" type="button" @click="switchPeriod">
                    <span>{{ period.period.name }}</span>
                    <span class="icon gray arrow-swap right-icon" />
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useCheckRoute, useNavigate, usePresent, useSplitViewController } from '@simonbackx/vue-app-navigation';
import { GroupAvatar, MembersTableView, PromiseComponent, Toast, useAuth, useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { useGetPeriods, useOrganizationManager, usePatchOrganizationPeriods } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupType, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useCollapsed } from '../../hooks/useCollapsed';
import EditCategoryGroupsView from '../dashboard/groups/EditCategoryGroupsView.vue';
import { useSwitchablePeriod } from './useSwitchablePeriod';

const $organization = useOrganization();
const $context = useContext();
const $navigate = useNavigate();
const collapsed = useCollapsed('leden');
const platform = usePlatform();
const organizationManager = useOrganizationManager();
const present = usePresent();
const auth = useAuth();
const splitViewController = useSplitViewController();
const patchOrganizationPeriods = usePatchOrganizationPeriods();
const getPeriods = useGetPeriods();

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: $context.value?.organizationPermissions,
        organization: $organization.value!,
    });
});

const { period, switchPeriod, openPeriod } = useSwitchablePeriod({
    onSwitch: async () => {
        // Make sure we open the first group again
        if (!splitViewController.value?.shouldCollapse()) {
            if (showAll.value) {
                await $navigate(Routes.All, {
                    properties: {
                        periodId: period.value.period.id,
                    },
                });
            } else if (tree.value.getAllGroups().length) {
                await $navigate(Routes.Group, {
                    properties: {
                        group: tree.value.getAllGroups()[0],
                        period: period.value,
                    },
                });
            }
        }
    },
});

const newestPeriod = computed(() => {
    return platform.value.period;
});

const canUpgradePeriod = computed(() => {
    if (STAMHOOFD.userMode === 'organization') {
        return false;
    }
    return $organization.value?.period.period.id !== platform.value.period.id && $organization.value!.period.period.startDate < platform.value.period.startDate && !platform.value.period.locked;
});

const canSetDefaultPeriod = computed(() => {
    if (period.value.id === $organization.value!.period.id) {
        return false;
    }
    return (period.value.period.id === platform.value.period.id && $organization.value!.period.period.id !== platform.value.period.id && !platform.value.period.locked)
        || (period.value.period.startDate > $organization.value!.period.period.startDate && !period.value.period.locked && (period.value.period.startDate.getTime() < new Date().getTime() + 1000 * 60 * 60 * 24 * 62));
});

const $rootCategory = computed(() => period.value.rootCategory);

const $canEdit = computed(() => organizationManager.value.user.permissions ? $rootCategory.value && $rootCategory.value.canEdit($context.value.auth.permissions) : false);

const getCategoryIcon = (category: GroupCategoryTree) => {
    if (category.settings.name.toLocaleLowerCase().includes('lessen') || category.settings.name.toLocaleLowerCase().includes('proefles')) {
        return 'education';
    }

    if (category.settings.name.toLocaleLowerCase().includes('activiteiten') || category.settings.name.toLocaleLowerCase().includes('kamp') || category.settings.name.toLocaleLowerCase().includes('weekend')) {
        return 'flag';
    }

    if (category.settings.name.toLocaleLowerCase().includes('betaling')) {
        return 'card';
    }

    if (category.categories.length) {
        return 'category';
    }

    return 'group';
};

const isCategoryDeactivated = (category: GroupCategoryTree) => {
    return period.value.isCategoryDeactivated($organization.value!, category);
};

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1
});

enum Routes {
    All = 'all',
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
}

defineRoutes([
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: MembersTableView,
        paramsToProps: () => {
            return {
                periodId: period.value.period.id,
            };
        },
        propsToParams() {
            return {
                params: {
                    slug: Formatter.slug(tree.value.settings.name),
                },
            };
        },
        isDefault: showAll.value
            ? {
                    properties: {
                        periodId: period.value.period.id,
                    },
                }
            : undefined,
    },
    {
        url: 'categorie/@slug',
        name: Routes.Category,
        params: {
            slug: String,
        },
        show: 'detail',
        component: async () => ((await import('../dashboard/groups/CategoryView.vue')).default),
        paramsToProps: (params: { slug: string }) => {
            const category = tree.value.getAllCategories().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!category) {
                throw new Error('Category not found');
            }
            return {
                category,
                period: period.value,
            };
        },
        propsToParams(props) {
            if (!('category' in props)) {
                throw new Error('Missing category');
            }
            return {
                params: {
                    slug: Formatter.slug((props.category as GroupCategory).settings.name),
                },
            };
        },
    },
    {
        url: '@slug',
        name: Routes.Group,
        params: {
            slug: String,
        },
        show: 'detail',
        component: async () => ((await import('../dashboard/groups/GroupOverview.vue')).default),
        paramsToProps: (params: { slug: string }) => {
            const group = tree.value.getAllGroups().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!group) {
                throw new Error('Group not found');
            }
            return {
                group,
                period: period.value,
            };
        },
        propsToParams(props) {
            if (!('group' in props)) {
                throw new Error('Missing group');
            }
            return {
                params: {
                    slug: Formatter.slug((props.group as Group).settings.name),
                },
            };
        },
        isDefault: tree.value.getAllGroups().length
            ? {
                    properties: {
                        group: tree.value.getAllGroups()[0],
                        period: period.value,
                    },
                }
            : undefined,
    },
]);

const checkRoute = useCheckRoute();

async function setDefaultPeriod() {
    // Patch organization period id
    try {
        await organizationManager.value.patch(
            Organization.patch({
                period: period.value,
            }),
        );

        // The period
        Toast.success($t('e875d12e-fa1d-43f5-b96a-be4ba8af04eb', { name: period.value.period.name })).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function upgradePeriod() {
    await openPeriod(platform.value.period);
}

async function editMe() {
    if (!$rootCategory.value) return;

    await present(PromiseComponent(async () => new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EditCategoryGroupsView, {
            category: $rootCategory.value,
            periodId: period.value.id,
            periods: await getPeriods(),
            organization: $organization.value,
            saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                await patchOrganizationPeriods(patch);
            },
        }),
    })).setDisplayStyle('popup'));
}
</script>
