import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AuditLogsView from '@stamhoofd/components/audit-logs/AuditLogsView.vue';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import ManageEventsView from '@stamhoofd/components/events/ManageEventsView.vue';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import NoPermissionsView from '@stamhoofd/components/auth/NoPermissionsView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem, TabBarItemGroup } from '@stamhoofd/components/containers/TabBarItem.ts';
import { getNonAutoLoginRoot, wrapContext } from '@stamhoofd/dashboard';
import { type useTranslate } from '@stamhoofd/frontend-i18n/I18nController';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { AccessRight, PermissionsResourceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import EventNotificationsTableView from './views/event-notifications/EventNotificationsTableView.vue';
import ChargeMembershipsView from './views/finances/ChargeMembershipsView.vue';
import MembersMenu from './views/members/MembersMenu.vue';
import OrganizationsMenu from './views/organizations/OrganizationsMenu.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, { root: component, initialPresents });
}

export async function getScopedAdminRootFromUrl({ $t }: { $t: ReturnType<typeof useTranslate> }) {
    const session = new SessionContext(null);
    await session.loadFromStorage();
    await session.checkSSO();
    await SessionManager.prepareSessionForUsage(session, false);

    return await getScopedAdminRoot(session, $t);
}

export function getNoPermissionsView() {
    return wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: $t(`%GV`),
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    }));
}

export async function getScopedAdminRoot(reactiveSession: SessionContext, $t: ReturnType<typeof useTranslate>, options: { initialPresents?: PushOptions[] } = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {}),
    });

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {}),
    });

    const membersTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(MembersMenu, {}),
    });

    const organizationsTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(OrganizationsMenu, {}),
    });

    setTitleSuffix($t(`%GW`));

    const startTab = new TabBarItem({
        id: 'start',
        icon: 'home',
        name: $t(`%I`),
        component: startView,
    });

    const membersTab = new TabBarItem({
        id: 'members',
        icon: 'group',
        name: $t(`%1EH`),
        component: membersTableView,
    });

    const groupsTab = new TabBarItem({
        id: 'organizations',
        icon: 'location',
        name: $t('%83'),
        component: organizationsTableView,
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`%GX`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ChargeMembershipsView, {}),
        }),
    });

    const eventNotificationsTab = new TabBarItem({
        id: 'event-notifications',
        icon: 'notification',
        name: $t(`%CV`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventNotificationsTableView, {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        id: 'audit-logs',
        icon: 'history',
        name: $t(`%GY`),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const settingsTab = new TabBarItem({
        id: 'settings',
        icon: 'settings',
        name: $t(`%xU`),
        component: settingsView,
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(CommunicationView, {}),
        }),
    });

    return wrapContext(reactiveSession, 'admin', ({ platformManager }) => wrapWithModalStack(
        new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: computed(() => {
                        const tabs: (TabBarItem | TabBarItemGroup)[] = [
                            startTab,
                            membersTab,
                        ];

                        if (!STAMHOOFD.singleOrganization) {
                            tabs.push(groupsTab);
                        }

                        if (platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', reactiveSession)) {
                            tabs.push(calendarTab);
                        }

                        const moreTab = new TabBarItemGroup({
                            icon: 'category',
                            name: $t(`%GZ`),
                            items: [],
                        });

                        if (reactiveSession.auth.hasFullAccess()) {
                            moreTab.items.push(settingsTab);
                            moreTab.items.push(communicationTab);
                            moreTab.items.push(financesTab);
                            moreTab.items.push(auditLogsTab);
                        }
                        else {
                            if (reactiveSession.auth.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders)) {
                                moreTab.items.push(communicationTab);
                            }
                        }

                        if (manualFeatureFlag('event-notifications', reactiveSession) && reactiveSession.auth.hasAccessRightForSomeResourceOfType(PermissionsResourceType.OrganizationTags, AccessRight.OrganizationEventNotificationReviewer)) {
                            // Feature is still in development so not visible for everyone
                            moreTab.items.push(eventNotificationsTab);
                        }

                        if (moreTab.items.length > 0) {
                            tabs.push(moreTab);
                        }

                        return tabs;
                    }),
                }),
            ),
            loginRoot: wrapWithModalStack(
                getNonAutoLoginRoot(reactiveSession, options),
            ),
            noPermissionsRoot: getNoPermissionsView(),
        }),
        options.initialPresents,
    ));
}
