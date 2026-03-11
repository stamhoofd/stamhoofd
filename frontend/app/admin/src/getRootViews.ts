import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, AuditLogsView, AuthenticatedView, CommunicationView, ManageEventsView, manualFeatureFlag, NoPermissionsView, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { getNonAutoLoginRoot, wrapContext } from '@stamhoofd/dashboard';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SessionContext, SessionManager } from '@stamhoofd/networking';
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
                name: $t(`31d1b160-113c-41b8-88c1-47ff191c52f1`),
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

    setTitleSuffix($t(`13b501d3-2ffc-460e-9cc5-9858b21ba842`));

    const startTab = new TabBarItem({
        id: 'start',
        icon: 'home',
        name: $t(`04548161-abc0-4bea-bdd3-fdbacddc22f8`),
        component: startView,
    });

    const membersTab = new TabBarItem({
        id: 'members',
        icon: 'group',
        name: $t(`19da8d23-acea-43c2-bfdd-742447ca57f1`),
        component: membersTableView,
    });

    const groupsTab = new TabBarItem({
        id: 'organizations',
        icon: 'location',
        name: $t('6e884f27-427f-4f85-914c-d5c2780253b0'),
        component: organizationsTableView,
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`60231186-b00f-4d07-a5c7-4a905467e254`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`bc00376e-db0e-4ace-aecc-9bfc05ee573e`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ChargeMembershipsView, {}),
        }),
    });

    const eventNotificationsTab = new TabBarItem({
        id: 'event-notifications',
        icon: 'notification',
        name: $t(`000be3fe-9354-4c2c-baf1-d0cd4d079830`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventNotificationsTableView, {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        id: 'audit-logs',
        icon: 'history',
        name: $t(`1b5413cd-5858-4a73-872b-5b6b26345039`),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const settingsTab = new TabBarItem({
        id: 'settings',
        icon: 'settings',
        name: $t(`5ca94078-d742-4e17-abf7-957c4721a559`),
        component: settingsView,
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`7dfd0425-b8ff-4dec-8c6d-257d94eabbe7`),
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
                            name: $t(`8c84aea8-4118-4cbf-a026-f86ae6bb2ceb`),
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
