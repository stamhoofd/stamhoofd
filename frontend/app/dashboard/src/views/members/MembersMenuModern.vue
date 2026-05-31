<template>
    <div class="st-menu-modern st-view members-menu">
        <STNavigationBar :title="$t(`%1EH`)" class="collapsed" />

        <main>
            <h1 v-if="true" class="adjusted">
                Leden
            </h1>

            <div class="block">
                <div class="items">
                    <button v-if="true" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon success small" />
                        <span>{{ $t('Stel alles op punt') }}</span>
                        <span class="right">2 / 8</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                        <span class="icon team small" />
                        <span>{{ $t('Alle leden') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon calendar small" />
                        <span>{{ $t('Kalender') }}</span>
                    </button>

                    <button v-if="false" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon file-pdf small" />
                        <span>{{ $t('Documenten en attesten') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Communication) }" @click="$navigate(Routes.Communication)">
                        <span class="icon email small" />
                        <span>{{ $t('Berichten') }}</span>
                    </button>

                    <button v-if="false" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon external small" />
                        <span>{{ $t('Toon ledenportaal') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon more-in-circle small" />
                        <span>{{ $t('Meer') }}</span>
                    </button>
                </div>
            </div>

            <STMenuCategory
                v-for="category in tree.categories"
                :id="category.id"
                :key="category.id"
                :title="category.settings.name"
                type="members"
                :selected="checkRoute(Routes.Category, {properties: {category, period}})"
                @open="$navigate(Routes.Category, {properties: {category, period}})"
            >
                <GroupCategoryBox
                    :category="category"
                    :period="period"
                    :check-route="checkRoute"
                    :navigate="$navigate"
                />
            </STMenuCategory>

            <STMenuCategory
                v-if="period.waitingLists.length"
                id="waiting-lists"
                :title="$t('Wachtlijsten')"
                type="members"
            >
                <STMenuItem
                    v-for="group in period.waitingLists"
                    :id="group.id"
                    :key="group.id"
                    :title="group.settings.name.toString()"
                    :selected="checkRoute(Routes.Group, {properties: {group, period}})"
                    :right-text="group.settings.registeredMembers !== null ? formatInteger(group.settings.registeredMembers) : null"
                    @click="$navigate(Routes.Group, {properties: {group, period}})"
                >
                    <template #icon>
                        <GroupAvatar :group="group" :allow-empty="false" />
                    </template>
                </STMenuItem>
            </STMenuCategory>

            <div v-if="false" class="block cta">
                <button class="menu-button title button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                    <span>{{ $t('Checklist') }}</span>
                    <span class="icon triangle-down small" />

                    <span class="right">1 / 4</span>
                </button>

                <div class="items">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon share small" />
                        <span>{{ $t('Deel je ledenportaal') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon bank small" />
                        <span>{{ $t('Betaalmethodes instellen') }}</span>
                        <span class="right icon circle small" />
                    </button>
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon calendar small" />
                        <span>{{ $t('Werkjaren instellen') }}</span>
                        <span class="right icon success small primary" />
                    </button>
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon group small" />
                        <span>{{ $t('Onderverdeling instellen') }}</span>
                        <span class="right icon success small primary" />
                    </button>
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon calendar small" />
                        <span>{{ $t('Werkjaren instellen') }}</span>
                        <span class="right icon success small primary" />
                    </button>
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon more-in-circle small" />
                        <span>{{ $t('Meer') }}</span>
                    </button>
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
import { ComponentWithProperties, defineRoutes, NavigationController, useCheckRoute, useNavigate, usePresent, useSplitViewController } from '@simonbackx/vue-app-navigation';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { PromiseComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import STMenuCategory from '@stamhoofd/components/menu/STMenuCategory.vue';
import STMenuItem from '@stamhoofd/components/menu/STMenuItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { Group, GroupCategory, GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import EditCategoryGroupsView from '../dashboard/groups/EditCategoryGroupsView.vue';
import MembersChecklistView from '../dashboard/settings/MembersChecklistView.vue';
import MembersSettingsView from '../dashboard/settings/MembersSettingsView.vue';
import GroupCategoryBox from './GroupCategoryBox.vue';
import { useSwitchablePeriod } from './useSwitchablePeriod';

const organization = useRequiredOrganization();
const context = useContext();
const $navigate = useNavigate();
const platform = usePlatform();
const organizationManager = useOrganizationManager();
const present = usePresent();
const auth = useAuth();
const splitViewController = useSplitViewController();
const patchOrganizationPeriods = usePatchOrganizationPeriods();
const getPeriods = useLoadRecentPeriods();

const hasFullAccess = computed(() => auth.hasFullAccess());

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: context.value?.organizationPermissions,
        organization: organization.value!,
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
    return organization.value?.period.period.id !== platform.value.period.id && organization.value!.period.period.startDate < platform.value.period.startDate && !platform.value.period.locked;
});

const canSetDefaultPeriod = computed(() => {
    if (period.value.id === organization.value!.period.id) {
        return false;
    }
    return (period.value.period.id === platform.value.period.id && organization.value!.period.period.id !== platform.value.period.id && !platform.value.period.locked)
        || (period.value.period.startDate > organization.value!.period.period.startDate && !period.value.period.locked && (period.value.period.startDate.getTime() < new Date().getTime() + 1000 * 60 * 60 * 24 * 62));
});

const rootCategory = computed(() => period.value.rootCategory);

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
    return period.value.isCategoryDeactivated(organization.value!, category);
};

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    Checklist = 'checklist',
    Settings = 'settings',
    All = 'all',
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
    Communication = 'berichten',
}

defineRoutes([
    {
        url: 'checklist',
        name: Routes.Checklist,
        show: 'detail',
        component: MembersChecklistView,
        isDefault: hasFullAccess.value
            ? { }
            : undefined,
    },

    {
        url: 'berichten',
        name: Routes.Communication,
        show: 'detail',
        component: CommunicationView,
    },

    {
        url: 'instellingen',
        name: Routes.Settings,
        show: 'detail',
        component: MembersSettingsView,
        isDefault: hasFullAccess.value
            ? { }
            : undefined,
    },
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
        Toast.success($t('%17o', { name: period.value.period.name })).show();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function upgradePeriod() {
    await openPeriod(platform.value.period);
}

async function editMe() {
    if (!rootCategory.value) return;

    await present(PromiseComponent(async () => new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EditCategoryGroupsView, {
            category: rootCategory.value,
            periodId: period.value.id,
            periods: await getPeriods(),
            organization: organization.value,
            saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                await patchOrganizationPeriods(patch);
            },
        }),
    })).setDisplayStyle('popup'));
}
</script>
