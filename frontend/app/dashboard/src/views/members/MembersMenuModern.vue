<template>
    <div class="st-menu-modern st-view members-menu" data-testid="members-menu">
        <STNavigationBar :title="props.period ? period.period.name : $t('Leden')" />

        <main>
            <h1 class="adjusted">
                <span>{{ props.period ? period.period.name : $t('Leden') }}</span>
            </h1>

            <p v-if="period.id !== organization.period.id && period.period.startDate > organization.period.period.startDate && !canSetDefaultPeriod && period.period.switchDate" class="info-box small">
                {{ $t('Dit is het toekomstig werkjaar. Het is nog niet actief. Leden kunnen nog niet inschrijven. Overschakelen kan ten vroegste vanaf {switchDate}.', {switchDate: Formatter.date(period.period.switchDate)}) }}
            </p>

            <div class="block">
                <div class="items">
                    <button
                        v-for="(action, index) of visibleActions"
                        :key="action.icon + '-' + index"
                        class="menu-button button hover-box"
                        type="button"
                        :class="{ selected: 'route' in action ? checkRoute(action.route) : false }"
                        @click="'route' in action ? $navigate(action.route) : action.action($event)"
                    >
                        <span :class="'icon small ' + action.icon" />
                        <span>{{ action.title }}</span>

                        <div class="right">
                            <span v-for="(button, btnIndex) of action.buttons" :key="btnIndex" v-tooltip="button.title" :class="'button icon gray tiny hover-show ' + button.icon" :disabled="button.loading" @click.stop="button.action($event)" />
                            <span v-if="action.rightText ">{{ action.rightText }}</span>
                        </div>
                    </button>
                </div>
            </div>

            <GroupCategoryMenuBox :period="period" />

            <div v-if="!props.period && auth.hasFullAccess()" class="container footer">
                <hr>

                <button class="st-menu-item" type="button" @click="switchPeriod">
                    <span class="icon date-range" />
                    <div>
                        <h3>{{ period.period.prefix }}</h3>
                        <p>{{ period.period.nameShort }}</p>
                    </div>
                    <span class="icon right gray arrow-swap" />
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, defineRoute, defineRoutes, SplitViewController, useCheckRoute, useNavigate, useNavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, ContextMenu, ContextMenuItem, EditRegistrationPeriodsView, StartNewRegistrationPeriodView, Toast, useFeatureFlag, usePlatform, useSetFeatureFlag } from '@stamhoofd/components';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods.ts';
import type { OrganizationRegistrationPeriod, RegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures/RegistrationPeriod.js';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import GroupTrashView from '../dashboard/groups/GroupTrashView.vue';
import MembersSettingsView from '../dashboard/settings/MembersSettingsView.vue';
import { useCreateCategoryView } from '../dashboard/settings/hooks/useCreateCategoryView';
import { useCreateGroupView } from '../dashboard/settings/hooks/useCreateGroupView';
import GroupCategoryMenuBox from './GroupCategoryMenuBox.vue';

const props = withDefaults(defineProps<{
    period?: OrganizationRegistrationPeriod | null;
}>(), {
    period: null,
});

const context = useContext();
const $navigate = useNavigate();
const auth = useAuth();
const platform = usePlatform();

const hasFullAccess = computed(() => auth.hasFullAccess());
const period = computed(() => props.period ?? organization.value.period);

const tree = computed(() => {
    console.log('Recalculated tree');
    return period.value.getCategoryTree({
        permissions: context.value?.organizationPermissions,
    });
});

const organization = useRequiredOrganization();
const navigationController = useNavigationController();
const hasFeature = useFeatureFlag();
const setFeature = useSetFeatureFlag();

const createCategoryView = useCreateCategoryView();
const createGroupView = useCreateGroupView();
const rootCategory = computed(() => period.value.settings.rootCategory);

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    Checklist = 'checklist',
    Settings = 'instellingen',
    All = 'all',
    Category = 'category',
    Group = 'group',
    Period = 'Period',
    GroupWithPeriod = 'groupWithPeriod',
    Communication = 'berichten',
    Trash = 'prullenmand',
    OrganizationRegistrationPeriods = 'instellingen/werkjaren',
}

defineRoute({
    url: 'p/@slug',
    name: Routes.Period,
    params: {
        slug: String,
    },
    component: (props) => {
        return new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./MembersMenuModern.vue'), props),
        });
    },
    show: {
        getCustomShow() {
            if (!navigationController.value.navigationController) {
                console.error('Mssing navigationController parent navigation controller');
                return navigationController.value.push;
            }
            return navigationController.value.navigationController.push;
        },
    },
    paramsToProps: async (params) => {
        let periods: RegistrationPeriodList;
        try {
            periods = await fetchPeriods({ shouldRetry: false });
        } catch (e) {
            Toast.fromError(e).show();
            throw e;
        }

        const period = periods.organizationPeriods.find(p => Formatter.slug(p.period.name) === params.slug);

        if (!period) {
            throw new Error('Group not found');
        }
        return {
            period,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.period.period.name),
            },
        };
    },
});

defineRoutes([
    /* {
        url: 'checklist',
        name: Routes.Checklist,
        show: 'detail',
        component: MembersChecklistView,
        isDefault: hasFullAccess.value
            ? { }
            : undefined,
    }, */

    /* {
        url: 'berichten',
        name: Routes.Communication,
        show: 'detail',
        component: CommunicationView,
    }, */

    {
        url: Routes.Settings,
        show: 'detail',
        component: MembersSettingsView,
        defaultProperties: () => {
            return {
                period: props.period, // don't pass period.value here
            };
        },
        isDefault: hasFullAccess.value && !props.period && STAMHOOFD.userMode === 'organization' && !hasFeature('disabled-members-onboarding')
            ? { }
            : undefined,
    },

    {
        // should match after settings
        url: Routes.OrganizationRegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView,
        defaultProperties: () => {
            return {
                period: props.period, // don't pass period.value here
            };
        },
    },

    {
        url: Routes.Trash,
        show: 'detail',
        component: GroupTrashView,
        defaultProperties: () => {
            return {
                period: period.value,
            };
        },
    },
]);

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
        ? {
                properties: {
                    periodId: period.value.period.id,
                },
            }
        : undefined,
});

const checkRoute = useCheckRoute();
const fetchPeriods = useFetchOrganizationRegistrationPeriods();
const present = usePresent();

async function startPeriod(p: RegistrationPeriod) {
    await present({
        components: [
            new ComponentWithProperties(StartNewRegistrationPeriodView, {
                period: p,
                callback: async () => {
                    const newList = await fetchPeriods({ shouldRetry: false, force: true });
                    const organizationPeriod = newList.organizationPeriods.find(o => o.period.id === p.id);

                    if (organizationPeriod) {
                        await $navigate(Routes.Period, {
                            properties: {
                                period: organizationPeriod,
                            },
                        });
                    }
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function switchPeriod(event: MouseEvent) {
    let periods: RegistrationPeriodList;
    try {
        periods = await fetchPeriods({ shouldRetry: false });
    } catch (e) {
        Toast.fromError(e).show();
        return;
    }

    const menu = new ContextMenu([
        periods.periods.map((p) => {
            return new ContextMenuItem({
                name: p.name,
                disabled: p.id === period.value.period.id ? $t('Dit is je huidige werkjaar') : false,
                action: async () => {
                    const existing = periods.organizationPeriods.find(pp => pp.period.id === p.id);
                    if (existing) {
                        await $navigate(Routes.Period, {
                            properties: {
                                period: existing,
                            },
                        });
                        return true;
                    }
                    await startPeriod(p);
                    return true;
                },
            });
        }),

        ...(STAMHOOFD.userMode === 'organization'
            ? ([
                    [
                        new ContextMenuItem({
                            name: $t('Werkjaren beheren'),
                            icon: 'settings',
                            action: async () => {
                                await $navigate(Routes.OrganizationRegistrationPeriods);
                                return true;
                            },
                        }),
                    ],
                ])
            : []),
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

class ActionButton {
    icon: string;
    title: string;
    loading = false;
    #action: (event: MouseEvent) => Promise<void> | void;

    constructor(options: {
        icon: string;
        title: string;
        action: (event: MouseEvent) => Promise<void> | void;
    }) {
        this.icon = options.icon;
        this.title = options.title;
        this.#action = options.action;
    }

    async action(event: MouseEvent) {
        this.loading = true;
        try {
            await this.#action(event);
        } catch (e) {
            if (Request.isAbortError(e)) {
                return;
            }
            Toast.fromError(e).show();
        } finally {
            this.loading = false;
        }
    }
};

type Action = {
    icon: string;
    title: string;
    rightText?: string;

    /**
     * Prefer to keep under 'More'
     */
    hidden?: boolean;
    buttons?: ActionButton[];
} & (
    {
        route: Routes;
    } | {
        action: (event: MouseEvent) => Promise<void> | void;
    }
);

const canSetDefaultPeriod = computed(() => {
    if (period.value.id === organization.value.period.id) {
        return false;
    }
    if (STAMHOOFD.userMode === 'organization') {
        return true;
    }

    return (
        (period.value.period.startDate >= platform.value.period.startDate && !period.value.period.locked)
        && (period.value.period.startDate > organization.value.period.period.startDate && !period.value.period.locked && (period.value.period.switchDate === null || period.value.period.switchDate < new Date()))
    );
});

const allActions = computed(() => {
    const list: Action[] = [];

    if (canSetDefaultPeriod.value) {
        list.push({
            icon: 'flag',
            title: $t('%8R'),
            action: () => {
                // return startPeriod(newestPeriod.value);
            },
        });
    }

    if (auth.hasFullAccess()) {
        // Checklist
        if (STAMHOOFD.userMode === 'organization' && !props.period) {
            list.push({
                icon: 'success',
                title: $t('Aan de slag'),
                route: Routes.Settings,
                hidden: hasFeature('disabled-members-onboarding'),
                buttons: !hasFeature('disabled-members-onboarding')
                    ? [
                            new ActionButton({
                                icon: 'close',
                                title: $t('Verbergen'),
                                action: async () => {
                                    await setFeature('disabled-members-onboarding', true);
                                },
                            }),
                        ]
                    : [],
            });
        }

        list.push({
            icon: 'settings',
            title: $t('Ledenadministratie instellingen'),
            route: Routes.Settings,
            hidden: true,
        });
        list.push({
            icon: 'team',
            title: $t('Alle leden'),
            route: Routes.All,
        });
    }

    if (!props.period) {
        /* list.push({
            icon: 'email-filled',
            title: $t('Berichten'),
            route: Routes.Communication,
            hidden: true,
        });

        list.push({
            icon: 'file-pdf',
            title: $t('Documenten en attesten'),
            route: Routes.Settings,
            hidden: true,
        });

        list.push({
            icon: 'history',
            title: $t('Leden logboek'),
            route: Routes.Settings,
            hidden: true,
        });

        list.push({
            icon: 'upload',
            title: $t('Leden importeren'),
            route: Routes.Settings,
            hidden: true,
        });

        list.push({
            icon: 'reverse',
            title: $t('Synchroniseren met groepsadmin'),
            route: Routes.Settings,
            hidden: true,
        }); */
    }

    if (rootCategory.value && auth.canCreateGroupInCategory(rootCategory.value)) {
        // A root category either holds subcategories or groups directly, never both
        list.push({
            icon: 'folder-add',
            title: $t('Nieuwe categorie'),
            hidden: true,
            action: async () => {
                await createCategoryView(period.value, rootCategory.value!);
            },
        });

        if (rootCategory.value.categoryIds.length === 0) {
            list.push({
                icon: 'add',
                title: $t('Nieuwe groep'),
                hidden: true,
                action: async () => {
                    await createGroupView(period.value, rootCategory.value!);
                },
            });
        }
    }

    list.push({
        icon: 'trash',
        title: $t('Prullenmand'),
        route: Routes.Trash,
        hidden: true,
    });

    return list;
});

const hiddenActions = computed(() => {
    return allActions.value.filter(a => !!a.hidden);
});

const visibleActions = computed(() => {
    const base = allActions.value.filter(a => !a.hidden);

    if (hiddenActions.value.length > 0) {
        // Add to more
        base.push({
            icon: 'more',
            title: $t('Meer'),
            action: async (event) => {
                const menu = new ContextMenu([
                    hiddenActions.value.map((a) => {
                        return new ContextMenuItem({
                            icon: a.icon,
                            name: a.title,
                            rightText: a.rightText,
                            action: async () => {
                                if ('route' in a) {
                                    await $navigate(a.route);
                                } else {
                                    await a.action(event);
                                }
                            },
                        });
                    }),
                ]);

                await menu.show({
                    button: event.currentTarget as HTMLElement,
                });
            },
        });
    }

    return base;
});

</script>
