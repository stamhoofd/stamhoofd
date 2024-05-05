import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, SplitViewController, setTitleSuffix } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AsyncComponent, AuthenticatedView, ContextProvider, OrganizationSwitcher, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, OrganizationManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Country, Organization } from '@stamhoofd/structures';

import { computed, reactive, ref } from 'vue';
import { MemberManager } from './classes/MemberManager';
import { WhatsNewCount } from './classes/WhatsNewCount';
import LoginView from './views/login/LoginView.vue';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, {root: component, initialPresents })
}

export function getOrganizationSelectionRoot() {
    return new ComponentWithProperties(OrganizationSelectionView, {})
}

export async function getScopedDashboardRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'aansluiten'];

    let session: SessionContext|null = null;

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

            session = new SessionContext(organization)
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

export function getScopedDashboardRoot(session: SessionContext, options: {initialPresents?: PushOptions[]} = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    I18nController.loadDefault(session, "dashboard", Country.Belgium, "nl", session?.organization?.address?.country).catch(console.error)
    const reactiveSession = reactive(session) as SessionContext

    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "StartView", webpackPrefetch: true */ './views/start/StartView.vue'), {})
    })

    setTitleSuffix(session.organization?.name ?? '');

    const startTab =  new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView
    });

    const membersTab = new TabBarItem({
        icon: 'group',
        name: 'Leden',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/members/MembersMenu.vue'), {})
        })
    });

    const webshopsTab = new TabBarItem({
        icon: 'basket',
        name: 'Verkoop',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import(/* webpackChunkName: "DashboardMenu", webpackPrefetch: true */ './views/dashboard/DashboardMenu.vue'), {})
        })
    });

    const whatsNewBadge = ref('')

    const loadWhatsNew = () => {
        const currentCount = localStorage.getItem("what-is-new")
        if (currentCount) {
            const c = parseInt(currentCount)
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                whatsNewBadge.value = (WhatsNewCount - c).toString()
            }
        } else {
            localStorage.setItem("what-is-new", (WhatsNewCount as any).toString());
        }
    }
    loadWhatsNew();

    const moreTab = new TabBarItemGroup({
        icon: 'category',
        name: 'Meer',
        items: [
            new TabBarItem({
                icon: 'calculator',
                name: 'Boekhouding',
                component: new ComponentWithProperties(SplitViewController, {
                    root: AsyncComponent(() => import('./views/dashboard/settings/FinancesView.vue'), {})
                })
            }),
            new TabBarItem({
                icon: 'file-filled',
                name: 'Documenten',
                component: new ComponentWithProperties(SplitViewController, {
                    root: AsyncComponent(() => import('./views/dashboard/documents/DocumentTemplatesView.vue'), {})
                })
            }),
            new TabBarItem({
                icon: 'gift',
                name: 'Wat is er nieuw?',
                badge: whatsNewBadge,
                action: async function () {
                    window.open('https://'+this.$t('shared.domains.marketing')+'/changelog', '_blank')
                    whatsNewBadge.value = '';
                    localStorage.setItem("what-is-new", WhatsNewCount.toString());
                }
            }),
            new TabBarItem({
                icon: 'book',
                name: 'Documentatie',
                action: async function () {
                    window.open('https://'+this.$t('shared.domains.marketing')+'/docs', '_blank')
                }
            }),
            new TabBarItem({
                icon: 'feedback',
                name: 'Feedback',
                action: async function () {
                    const NoltHelper = (await import('./classes/NoltHelper'))
                    await NoltHelper.openNolt(reactiveSession, false)
                }
            })
        ]
    });

    const settingsTab = new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/SettingsView.vue'), {})
        })
    })

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: new OrganizationManager(reactiveSession),
            $memberManager: new MemberManager(reactiveSession),
            reactive_navigation_url: "beheerders/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {})
            },
            stamhoofd_app: 'dashboard'
        },
        calculatedContext: () => {
            return {
                $organization: computed(() => reactiveSession.organization),
                $user: computed(() => reactiveSession.user),
            }
        },
        root: wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: computed(() => {
                            const organization = reactiveSession.organization;

                            const tabs: (TabBarItem|TabBarItemGroup)[] = [
                                startTab
                            ]

                            if (organization?.meta.packages.useMembers) {
                                tabs.push(membersTab)
                            }

                            if (organization?.meta.packages.useWebshops) {
                                tabs.push(webshopsTab)
                            }

                            tabs.push(settingsTab);
                            tabs.push(moreTab);

                            return tabs;
                        })
                    })
                ),
                loginRoot: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: [
                            new TabBarItem({
                                icon: 'key',
                                name: 'Inloggen',
                                component: new ComponentWithProperties(NavigationController, {
                                    root: new ComponentWithProperties(LoginView, {})
                                })
                            })
                        ]
                    })
                ),
                noPermissionsRoot: wrapWithModalStack(AsyncComponent(() => import(/* webpackChunkName: "NoPermissionsView" */ './views/login/NoPermissionsView.vue'), {})),
            }), 
            options.initialPresents
        )
    });
}
