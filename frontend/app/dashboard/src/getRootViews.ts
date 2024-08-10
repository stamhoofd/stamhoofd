import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix,SplitViewController } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AsyncComponent, AuthenticatedView, ContextNavigationBar, ContextProvider, CoverImageContainer, LoginView, ManageEventsView, NoPermissionsView,OrganizationSwitcher, ReplaceRootEventBus, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { PromiseView } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, OrganizationManager, PlatformManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { AccessRight, Country, Organization } from '@stamhoofd/structures';
import { computed, markRaw, reactive, ref } from 'vue';

import { WhatsNewCount } from './classes/WhatsNewCount';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, {root: component, initialPresents })
}

export async function loadSessionFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'aansluiten'];

    let session: SessionContext|null = null;

    console.log('load session', parts)

    if (parts[1] && !ignoreUris.includes(parts[1])) {
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

            session = reactive(new SessionContext(organization)) as SessionContext;
            await session.loadFromStorage()
            await SessionManager.prepareSessionForUsage(session, false);
        } catch (e) {
            console.error('Failed to load organization from uri', uri);
        }
    }

    return session;
}
export function getLoginRoot() {
    return new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? ''
            })
        })
    })
}

export async function getOrganizationSelectionRoot() {
    const session = reactive(new SessionContext(null)) as SessionContext;
    const reactiveSession = session
    await session.loadFromStorage()
    await SessionManager.prepareSessionForUsage(session, false);
    await I18nController.loadDefault(reactiveSession, Country.Belgium, "nl")

    const platformManager = await PlatformManager.createFromCache(reactiveSession, true)

    let baseRoot = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {})
        })
    })
    

    if (STAMHOOFD.userMode === 'platform') {
        // In platform mode, we need authentication
        baseRoot = new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(baseRoot),
            loginRoot: wrapWithModalStack(getLoginRoot()),
        });
    }

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: reactiveSession,
            $platformManager: platformManager,
            reactive_navigation_url: "/",
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {}),
                "tabbar-replacement": new ComponentWithProperties(ContextNavigationBar, {})
            },
            stamhoofd_app: 'auto',
        }),
        root: wrapWithModalStack(baseRoot)
    });
}

export function getNoPermissionsView() {
    return  wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: 'Geen toegang',
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {})
                })
            })
        ]
    }))
}

export async function getScopedDashboardRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const session = await loadSessionFromUrl()
        
    if (!session || !session.organization) {
        return getOrganizationSelectionRoot()
    }

    return await getScopedDashboardRoot(session)
}

export async function getScopedAutoRootFromUrl() {
    const fromUrl = await loadSessionFromUrl()
    const session = reactive(fromUrl ?? (await SessionManager.getLastGlobalSession())) as SessionContext;
    await SessionManager.prepareSessionForUsage(session, false);
    
    return await getScopedAutoRoot(session)
}

export async function getScopedAutoRoot(session: SessionContext, options: {initialPresents?: PushOptions[]} = {}) {    
    if (!session.user) {
        // We can't really determine the automatic root view because we are not signed in
        // So return the login view, that will call getScopedAutoRoot again after login
        const reactiveSession = reactive(session) as SessionContext
        const platformManager = await PlatformManager.createFromCache(reactiveSession, true)
        I18nController.loadDefault(reactiveSession, Country.Belgium, "nl", session?.organization?.address?.country).catch(console.error)

        return new ComponentWithProperties(ContextProvider, {
            context: markRaw({
                $context: reactiveSession,
                $platformManager: platformManager,
                reactive_navigation_url: "auto/" + session.organization!.uri,
                reactive_components: {
                    "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                    "tabbar-right": new ComponentWithProperties(AccountSwitcher, {}),
                    "tabbar-replacement": new ComponentWithProperties(ContextNavigationBar, {})
                },
                stamhoofd_app: 'auto',
            }),
            root: wrapWithModalStack(
                new ComponentWithProperties(AuthenticatedView, {
                    root: new ComponentWithProperties(PromiseView, {
                        promise: async () => {
                            // Replace itself again after a successful login
                            const root = await getScopedAutoRoot(reactiveSession, options)
                            await ReplaceRootEventBus.sendEvent('replace', root);
                            return new ComponentWithProperties({}, {});
                        }
                    }),
                    loginRoot: wrapWithModalStack(getLoginRoot()),
                })
            )
        });
    }

    
    // Make sure users without permissions always go to the member portal automatically
    if (((!session.organization && !session.auth.userPermissions) || (session.organization && !session.auth.permissions)) && (STAMHOOFD.userMode === 'platform' || (session.organization && session.organization.meta.packages.useMembers))) {
        const registration = await import('@stamhoofd/registration');
        return await registration.getRootView(session)
    }

    if (session.organization) {
        return await getScopedDashboardRoot(session, options)
    }

    // Users with permissions should always have the option to choose the member portal or the dashboard
    return getOrganizationSelectionRoot()
}

export async function getScopedDashboardRoot(session: SessionContext, options: {initialPresents?: PushOptions[]} = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const reactiveSession = reactive(session) as SessionContext
    I18nController.loadDefault(reactiveSession, Country.Belgium, "nl", session?.organization?.address?.country).catch(console.error)

    const platformManager = await PlatformManager.createFromCache(reactiveSession, true)

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

    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: 'Activiteiten',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {})
        })
    });

    const webshopsTab = new TabBarItem({
        icon: 'basket',
        name: 'Verkoop',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/webshops/WebshopsMenu.vue'), {})
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

    const settingsTab = new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/SettingsView.vue'), {})
        })
    })

    const financesTab = new TabBarItem({
        icon: 'calculator',
        name: 'Boekhouding',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/FinancesView.vue'), {})
        })
    })

    const sharedMoreItems = [
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

    // todo: accept terms view
    // if (this.fullAccess && !this.$organization.meta.didAcceptLatestTerms) {
    //     // Show new terms view if needed
    //     LoadComponent(() => import(/* webpackChunkName: "AcceptTermsView" */ "./AcceptTermsView.vue"), {}, { instant: true }).then((component) => {
    //         this.present(component.setDisplayStyle("popup").setAnimated(false))
    //     }).catch(console.error)
    // }

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: reactiveSession,
            $platformManager: platformManager,
            $organizationManager: new OrganizationManager(reactiveSession),
            reactive_navigation_url: "beheerders/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {}),
                "tabbar-replacement": new ComponentWithProperties(ContextNavigationBar, {})
            },
            stamhoofd_app: 'dashboard',
        }),
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

                                if (reactiveSession.auth.hasFullAccess()) {
                                    tabs.push(calendarTab)
                                }
                            }

                            if (organization?.meta.packages.useWebshops) {
                                tabs.push(webshopsTab)
                            }

                            const moreTab = new TabBarItemGroup({
                                icon: 'category',
                                name: 'Meer',
                                items: [
                                    ...sharedMoreItems // need to create a new array, don't pass directly!
                                ]
                            });

                            if (reactiveSession.auth.hasFullAccess()) {
                                moreTab.items.unshift(financesTab)
                                moreTab.items.unshift(settingsTab)
                            } else if (reactiveSession.auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                                moreTab.items.unshift(financesTab)
                            }

                            tabs.push(moreTab)

                            return tabs;
                        })
                    })
                ),
                loginRoot: wrapWithModalStack(getLoginRoot()),
                noPermissionsRoot: getNoPermissionsView(),
            }), 
            options.initialPresents
        )
    });
}
