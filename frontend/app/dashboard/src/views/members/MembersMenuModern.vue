<template>
    <div class="st-menu-modern st-view members-menu">
        <STNavigationBar :title="props.period ? period.period.name : $t('Leden')" />

        <main>
            <h1 class="adjusted">
                <span>{{ props.period ? period.period.name : $t('Leden') }}</span>
            </h1>

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
import { ComponentWithProperties, defineRoute, defineRoutes, SplitViewController, useCheckRoute, useNavigate, useNavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, ContextMenu, ContextMenuItem, Toast, useFeatureFlag, useSetFeatureFlag } from '@stamhoofd/components';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods.ts';
import type { OrganizationRegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures/RegistrationPeriod.js';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import GroupTrashView from '../dashboard/groups/GroupTrashView.vue';
import MembersChecklistView from '../dashboard/settings/MembersChecklistView.vue';
import MembersSettingsView from '../dashboard/settings/MembersSettingsView.vue';
import GroupCategoryMenuBox from './GroupCategoryMenuBox.vue';

const props = withDefaults(defineProps<{
    period?: OrganizationRegistrationPeriod | null;
}>(), {
    period: null,
});

const context = useContext();
const $navigate = useNavigate();
const auth = useAuth();

const hasFullAccess = computed(() => auth.hasFullAccess());

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: context.value?.organizationPermissions,
        organization: organization.value!,
    });
});

const organization = useRequiredOrganization();
const period = computed(() => props.period ?? organization.value.period);
const navigationController = useNavigationController();

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    Checklist = 'checklist',
    Settings = 'settings',
    All = 'all',
    Category = 'category',
    Group = 'group',
    Period = 'Period',
    GroupWithPeriod = 'groupWithPeriod',
    Communication = 'berichten',
    Trash = 'prullenmand',
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
        url: Routes.Trash,
        show: 'detail',
        component: GroupTrashView,
        defaultProperties: () => {
            return {
                period: period.value,
            };
        },
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
]);

const checkRoute = useCheckRoute();
const fetchPeriods = useFetchOrganizationRegistrationPeriods();

async function switchPeriod(event: MouseEvent) {
    let periods: RegistrationPeriodList;
    try {
        periods = await fetchPeriods({ shouldRetry: false });
    } catch (e) {
        Toast.fromError(e).show();
        return;
    }

    const menu = new ContextMenu([
        periods.organizationPeriods.map((p) => {
            return new ContextMenuItem({
                name: p.period.name,
                action: async () => {
                    await $navigate(Routes.Period, {
                        properties: {
                            period: p,
                        },
                    });
                    return true;
                },
            });
        }),
        [
            new ContextMenuItem({
                name: 'Instellingen',
                icon: 'settings',
                action: () => {
                    // todo
                    return true;
                },
            }),
        ],
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

const hasFeature = useFeatureFlag();
const setFeature = useSetFeatureFlag();

const allActions = computed(() => {
    const list: Action[] = [];

    if (!props.period) {
        // Default period

        // Checklist
        if (STAMHOOFD.userMode === 'organization') {
            list.push({
                icon: 'settings',
                title: $t('Instellen'),
                route: Routes.Settings,
                rightText: '1 / 5',
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
    }

    if (auth.hasFullAccess()) {
        list.push({
            icon: 'team',
            title: $t('Alle leden'),
            route: Routes.All,
        });
    }

    if (!props.period) {
        list.push({
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
        });
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
