import { ComponentWithProperties, ModalStackComponent, NavigationController, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import AuditLogsView from '@stamhoofd/components/audit-logs/AuditLogsView.vue';
import NoPermissionsView from '@stamhoofd/components/auth/NoPermissionsView.vue';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem, TabBarItemGroup } from '@stamhoofd/components/containers/TabBarItem.ts';
import ManageEventsView from '@stamhoofd/components/events/ManageEventsView.vue';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { AccessRight, PermissionsResourceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import EventNotificationsTableView from './views/event-notifications/EventNotificationsTableView.vue';
import ChargeMembershipsView from './views/finances/ChargeMembershipsView.vue';
import MembersMenu from './views/members/MembersMenu.vue';
import OrganizationsMenu from './views/organizations/OrganizationsMenu.vue';
import WebshopsTableView from './views/webshops/WebshopsTableView.vue';
import { wrapContext } from '@stamhoofd/dashboard';
import type { PlatformManager, SessionContext } from '@stamhoofd/networking';
import { SessionManager } from '@stamhoofd/networking';
import { getAuthComponent } from '../../auth/getAuthComponent.ts';
import { PermissionsCheckedView } from '@stamhoofd/components';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

function getNoPermissionsView() {
    return new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: $t(`%GV`),
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    });
}

function buildComponent(session: SessionContext) {
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

    const webshopsTab = new TabBarItem({
        id: 'webshops',
        icon: 'basket',
        name: $t('%1Pd'),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(WebshopsTableView, {}),
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

    return (platformManager: PlatformManager) => new ComponentWithProperties(TabBarController, {
        tabs: computed(() => {
            const tabs: (TabBarItem | TabBarItemGroup)[] = [
                startTab,
                membersTab,
            ];

            if (!STAMHOOFD.singleOrganization) {
                tabs.push(groupsTab);
            }

            if (platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', session)) {
                tabs.push(calendarTab);
            }

            const moreTab = new TabBarItemGroup({
                icon: 'category',
                name: $t(`%GZ`),
                items: [],
            });

            if (session.auth.hasFullAccess()) {
                moreTab.items.push(settingsTab);
                moreTab.items.push(communicationTab);
                moreTab.items.push(financesTab);
                moreTab.items.push(webshopsTab);
                moreTab.items.push(auditLogsTab);
            } else {
                if (session.auth.canReadEmails()) {
                    moreTab.items.push(communicationTab);
                }
            }

            if (manualFeatureFlag('event-notifications', session) && session.auth.hasAccessRightForSomeResourceOfType(PermissionsResourceType.OrganizationTags, AccessRight.OrganizationEventNotificationReviewer)) {
                // Feature is still in development so not visible for everyone
                moreTab.items.push(eventNotificationsTab);
            }

            if (moreTab.items.length > 0) {
                tabs.push(moreTab);
            }

            return tabs;
        }),
    });
}

export async function getAdminComponent() {
    const session = await SessionManager.getLastGlobalSession();

    const root = buildComponent(session);

    return wrapContext(session, 'admin', async ({ platformManager }) => await getAuthComponent(new ComponentWithProperties(PermissionsCheckedView, {
        noPermissionsRoot: wrapWithModalStack(getNoPermissionsView()),
        root: wrapWithModalStack(root(platformManager)),
    }), null));
}
