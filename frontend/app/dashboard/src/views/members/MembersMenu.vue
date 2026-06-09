<template>
    <div class="st-menu st-view members-menu" data-testid="members-menu">
        <STNavigationBar :title="$t(`%1EH`)">
            <template #right>
                <button v-if="$canEdit" class="button icon settings" type="button" @click="editMe" />
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>{{ $t('%1EH') }}</h1>

            <template v-if="auth.hasFullAccess()">
                <button v-if="canUpgradePeriod" type="button" class="menu-button button cta" @click="upgradePeriod">
                    <span class="icon flag" />
                    <span>{{ $t('%17m', {'werkjaar-2025-2026': newestPeriod.name}) }}</span>
                </button>
                <button v-else-if="canSetDefaultPeriod" type="button" class="menu-button button cta" @click="setDefaultPeriod">
                    <span class="icon flag" />
                    <span>{{ $t('%8R') }}</span>
                </button>
                <div v-else-if="period.id !== $organization.period.id" class="info-box">
                    {{ $t('%17n') }}
                </div>

                <hr v-if="canUpgradePeriod || canSetDefaultPeriod">
            </template>

            <p v-if="tree.categories.length === 0" class="info-box">
                {{ $t('%WK') }}
            </p>

            <div v-if="showAll" class="container">
                <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                    <span class="icon ul" />
                    <span>{{ $t('%L8') }}</span>
                </button>
            </div>
            <hr v-if="showAll">
            <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                <div class="grouped">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Category, {properties: {category, period}}) }" @click="$navigate('category', {properties: {category, period}})">
                        <span :class="'icon ' + getCategoryIcon(category)" />
                        <span>{{ category.settings.name }}</span>
                        <span v-if="category.groups.length || category.categories.length" class="button icon arrow-down-small right-icon rot" :class="{rot180: collapsed.isCollapsed(category.id)}" @click.stop="collapsed.toggle(category.id)" />
                    </button>

                    <div :class="{collapsable: true, hide: collapsed.isCollapsed(category.id)}">
                        <button v-for="c in category.categories" :key="c.id" class="menu-button button sub-button" :class="{ selected: checkRoute(Routes.Category, {properties: {category: c, period}}) }" type="button" @click="$navigate(Routes.Category, {properties: {category: c, period}})">
                            <span class="icon" />
                            <span>{{ c.settings.name }}</span>
                        </button>

                        <button v-for="group in category.groups" :key="group.id" class="menu-button button sub-button" :class="{ selected: checkRoute(Routes.Group, {properties: {group, period}}) }" type="button" @click="$navigate(Routes.Group, {properties: {group, period}})">
                            <GroupAvatar :group="group" :allow-empty="false" />
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
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoute, NavigationController, useCheckRoute, useNavigate, usePresent, useSplitViewController } from '@simonbackx/vue-app-navigation';
import { PromiseComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useGlobalEventListener } from '@stamhoofd/components/hooks/useGlobalEventListener.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import { useCollapsed } from '@stamhoofd/components/menu/useCollapsed';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { Group, GroupCategory, GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
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
const getPeriods = useLoadRecentPeriods();

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: $context.value?.organizationPermissions,
    });
});

const { period, switchPeriod, openPeriod } = useSwitchablePeriod({
    onSwitch: async () => {
        // Make sure we open the first group again
        if (!splitViewController.value?.shouldCollapse()) {
            if (showAll.value) {
                await $navigate(Routes.All, {
                    properties: {
                        period: period.value.period,
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

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    All = 'all',
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
}

defineRoute({
    url: 'allemaal',
    name: Routes.All,
    show: 'detail',
    component: MembersTableView,
    defaultProperties: () => {
        return {
            periodId: period.value.period.id,
        };
    },
    isDefault: showAll.value
        ? {}
        : undefined,
});

defineRoute({
    url: 'categorie/@slug',
    name: Routes.Category,
    params: {
        slug: String,
    },
    show: 'detail',
    component: async () => ((await import('../dashboard/groups/CategoryView.vue')).default),
    paramsToProps: (params) => {
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
        return {
            params: {
                slug: Formatter.slug((props.category as GroupCategory).settings.name),
            },
        };
    },
});

defineRoute({
    url: '@slug',
    name: Routes.Group,
    params: {
        slug: String,
    },
    show: 'detail',
    component: async () => ((await import('../dashboard/groups/GroupOverview.vue')).default),
    paramsToProps: (params) => {
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
});

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
        Toast.success($t('%17o', { name: period.value.period.name })).show();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function upgradePeriod() {
    await openPeriod(platform.value.period);
}

async function editMe() {
    if (!$rootCategory.value) return;

    await present({
        components: [
            PromiseComponent(async () => {
                const periods = await getPeriods();
                return new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditCategoryGroupsView, {
                        category: $rootCategory.value,
                        period: period.value,
                        periods,
                        organization: $organization.value,
                        saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                            await patchOrganizationPeriods(patch, { periods });
                        },
                    }),
                });
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
