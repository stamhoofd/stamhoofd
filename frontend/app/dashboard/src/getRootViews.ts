import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, SplitViewController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, AuthenticatedView, ContextProvider, TabBarController, TabBarItem } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, OrganizationManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Country, Organization } from '@stamhoofd/structures';

import { MemberManager } from './classes/MemberManager';
import LoginView from './views/login/LoginView.vue';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';
import { computed, reactive } from 'vue';
import OrganizationSwitcher from './views/dashboard/OrganizationSwitcher.vue';

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function getOrganizationSelectionRoot() {
    return new ComponentWithProperties(OrganizationSelectionView, {})
}

export async function getScopedDashboardRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'aansluiten'];

    let session: Session|null = null;

    if (parts[0] === 'beheerders' && parts[1] && !ignoreUris.includes(parts[1])) {
        const uri = parts[1];

        // Load organization
        // todo: use cache
        try {
            const response = await NetworkManager.server.request({
                method: "GET",
                path: "/organization-from-uri",
                query: {
                    uri
                },
                decoder: Organization as Decoder<Organization>
            })
            const organization = response.data

            session = new Session(organization.id)
            session.setOrganization(organization)
            await session.loadFromStorage()
            await SessionManager.prepareSessionForUsage(session, false);

            // UrlHelper.fixedPrefix = "beheerders/" + organization.uri;

        } catch (e) {
            console.error('Failed to load organization from uri', uri);
        }
    }
    
    await I18nController.loadDefault(session, "dashboard", Country.Belgium, "nl", session?.organization?.address?.country)
    
    if (!session || !session.organization) {
        return getOrganizationSelectionRoot()
    }

    return getScopedDashboardRoot(session)
}

export function getScopedDashboardRoot(session: Session, options: {loginComponents?: ComponentWithProperties[]} = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    I18nController.loadDefault(session, "dashboard", Country.Belgium, "nl", session?.organization?.address?.country).catch(console.error)
    const reactiveSession = reactive(session) as Session


    const getManageFinances = () => {
        return new ComponentWithProperties(NavigationController, { 
            root: AsyncComponent(() => import(/* webpackChunkName: "FinancesView", webpackPrefetch: true */ './views/dashboard/settings/FinancesView.vue'), {})
        }, {
            provide: {
                reactive_navigation_url: this.$url.extendUrl("finances"), // own prefix + /finances
            }
        })
    }
    const getManageSettings = function(this: any) {
        return new ComponentWithProperties(NavigationController, { 
            root: AsyncComponent(() => import(/* webpackChunkName: "SettingsView", webpackPrefetch: true */ './views/dashboard/settings/SettingsView.vue'), {})
        }, {
            provide: {
                reactive_navigation_url: computed(() => this.$url.extendUrl("settings")), // own prefix + /settings
            }
        })
    }
    const getManageAccount = () => {
        return new ComponentWithProperties(NavigationController, { 
            root: AsyncComponent(() => import(/* webpackChunkName: "AccountSettingsView", webpackPrefetch: true */ './views/dashboard/account/AccountSettingsView.vue'), {})
        }, {
            provide: {
                reactive_navigation_url: this.$url.extendUrl("account"), // own prefix + /settings
            }
        })
    }

    const splitViewController = new ComponentWithProperties(SplitViewController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "DashboardMenu", webpackPrefetch: true */ './views/dashboard/DashboardMenu.vue'), {}),
        getDefaultDetail(this: any): ComponentWithProperties {
            const fullAccess = reactiveSession.user?.permissions?.hasFullAccess(reactiveSession.organization?.privateMeta?.roles ?? [])
            const canManagePayments = reactiveSession.user?.permissions?.canManagePayments(reactiveSession.organization?.privateMeta?.roles ?? [])

            if (fullAccess) {
                return getManageSettings.call(this)
            } else if (canManagePayments) {
                return getManageFinances.call(this)
            } else {
                return getManageAccount.call(this)
            }
        }
    })

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: new OrganizationManager(reactiveSession),
            $memberManager: new MemberManager(reactiveSession),
            reactive_navigation_url: "beheerders/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {})
            }
        },
        calculatedContext: () => {
            return {
                $organization: computed(() => reactiveSession.organization),
                $user: computed(() => reactiveSession.user),
            }
        },
        root: new ComponentWithProperties(AuthenticatedView, {
            setFixedPrefix: "beheerders",
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: [
                        new TabBarItem({
                            icon: 'home',
                            name: 'Start',
                            component: splitViewController
                        }),
                        new TabBarItem({
                            icon: 'group',
                            name: 'Leden',
                            component: splitViewController.clone()
                        }),
                        new TabBarItem({
                            icon: 'basket',
                            name: 'Verkoop',
                            component: splitViewController.clone()
                        }),
                        new TabBarItem({
                            icon: 'category',
                            name: 'Meer',
                            component: splitViewController.clone()
                        }),
                    ]
                })
            ),
            loginRoot: wrapWithModalStack(
                new ComponentWithProperties(LoginView, {}), ...(options.loginComponents ?? [])
            ),
            noPermissionsRoot: wrapWithModalStack(AsyncComponent(() => import(/* webpackChunkName: "NoPermissionsView" */ './views/login/NoPermissionsView.vue'), {})),
        })
    });
}
