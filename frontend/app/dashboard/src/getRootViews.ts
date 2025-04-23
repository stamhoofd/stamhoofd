import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AppType, AsyncComponent, AuditLogsView, AuthenticatedView, ContextNavigationBar, ContextProvider, CoverImageContainer, CustomHooksContainer, LoginView, ManageEventsView, manualFeatureFlag, NoPermissionsView, OrganizationLogo, OrganizationSwitcher, PromiseView, ReplaceRootEventBus, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { I18nController, LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { MemberManager, NetworkManager, OrganizationManager, PlatformManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { AccessRight, Country, Organization, PermissionLevel, Webshop } from '@stamhoofd/structures';
import { computed, markRaw, reactive, ref } from 'vue';

import { SimpleError } from '@simonbackx/simple-errors';
import RedirectView from '@stamhoofd/components/src/auth/RedirectView.vue';
import { CheckoutManager } from '../../webshop/src/classes/CheckoutManager';
import { WebshopManager } from '../../webshop/src/classes/WebshopManager';
import { WhatsNewCount } from './classes/WhatsNewCount';
import { useGlobalRoutes } from './useGlobalRoutes';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, { root: component, initialPresents });
}

export async function wrapContext(context: SessionContext, app: AppType | 'auto', buildComponent: ComponentWithProperties | ((data: { platformManager: PlatformManager }) => ComponentWithProperties), options?: { ownDomain?: boolean; initialPresents?: PushOptions[]; webshop?: Webshop }) {
    const platformManager = await PlatformManager.createFromCache(context, app, true);
    const $memberManager = new MemberManager(context, platformManager.$platform);
    await I18nController.loadDefault(context, Country.Belgium, 'nl', context?.organization?.address?.country);

    if (app === 'webshop' && !options?.webshop) {
        throw new Error('Webshop is required for webshop app');
    }

    const $webshopManager = options?.webshop ? reactive(new WebshopManager(context, platformManager.$platform, options.webshop) as any) as WebshopManager : null;
    const $checkoutManager = $webshopManager ? reactive(new CheckoutManager($webshopManager)) : null;

    const component = typeof buildComponent === 'function' ? buildComponent({ platformManager }) : buildComponent;

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $platformManager: platformManager,
            $memberManager,
            $organizationManager: new OrganizationManager(context),
            $webshopManager,
            $checkoutManager,
            reactive_components: {
                'tabbar-left': options?.ownDomain && context.organization
                    ? new ComponentWithProperties(OrganizationLogo, {
                        organization: context.organization,
                    })
                    : new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
        }),
        root: wrapWithModalStack(new ComponentWithProperties(CustomHooksContainer, {
            root: component,
            hooks: () => {
                useGlobalRoutes();
            },
        }), options?.initialPresents),
    });
}

export async function sessionFromOrganization(data: ({ organization: Organization } | { organizationId: string })) {
    const session = await SessionContext.createFrom(data);
    await session.loadFromStorage();
    await session.checkSSO();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

export async function loadSessionFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'aansluiten', 'start', 'activiteiten', 'mandje', 'leden'];

    let session: SessionContext | null = null;

    console.log('load session', parts);

    if (STAMHOOFD.singleOrganization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    else if (parts[1] && !ignoreUris.includes(parts[1])) {
        const uri = parts[1];

        // Load organization
        // todo: use cache
        try {
            const response = await NetworkManager.server.request({
                method: 'GET',
                path: '/organization-from-uri',
                query: {
                    uri,
                },
                decoder: Organization as Decoder<Organization>,
            });
            const organization = response.data;
            session = await sessionFromOrganization({ organization });
        }
        catch (e) {
            console.error('Failed to load organization from uri', uri);
            session = null;
        }
    }

    if (!session) {
        session = await SessionManager.getLastGlobalSession();
        await session.checkSSO();
    }

    return session;
}

export function getLoginRoot() {
    if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN && UrlHelper.initial.getSearchParams().get('skipRedirect') !== 'true') {
        const urlCopy = new URL(UrlHelper.initial.url);
        urlCopy.hostname = STAMHOOFD.REDIRECT_LOGIN_DOMAIN;

        return new ComponentWithProperties(RedirectView, {
            location: urlCopy.href,
        });
    }

    return new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
            }),
        }),
    });
}

export function getNonAutoLoginRoot(reactiveSession: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    // In platform mode, we always redirect to the 'auto' login view, so that we redirect the user to the appropriate environment after signin in
    if (STAMHOOFD.userMode === 'platform') {
        return new ComponentWithProperties(PromiseView, {
            promise: async () => {
                // Replace itself again after a successful login
                const root = await getScopedAutoRoot(reactiveSession, options);
                await ReplaceRootEventBus.sendEvent('replace', root);
                return new ComponentWithProperties({}, {});
            },
        });
    }

    return getLoginRoot();
}

export async function getOrganizationSelectionRoot(session: SessionContext) {
    const reactiveSession = session;
    await session.loadFromStorage();
    await SessionManager.prepareSessionForUsage(session, false);

    let baseRoot = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {}),
        }),
    });

    if (STAMHOOFD.userMode === 'platform') {
        // In platform mode, we need authentication
        baseRoot = new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(baseRoot),
            loginRoot: wrapWithModalStack(getLoginRoot()),
        });
    }

    return await wrapContext(reactiveSession, 'auto', baseRoot);
}

export function getNoPermissionsView() {
    return wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: 'Geen toegang',
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    }));
}

export async function getScopedDashboardRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const session = await loadSessionFromUrl();

    if (!session.organization) {
        // Invalid URL
        return getScopedAutoRoot(session);
    }

    return await getScopedDashboardRoot(session);
}

export async function getScopedAutoRootFromUrl() {
    const session = await loadSessionFromUrl();
    await SessionManager.prepareSessionForUsage(session, false);

    return await getScopedAutoRoot(session);
}

export async function getScopedAutoRoot(session: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    if (!session.user) {
        // We can't really determine the automatic root view because we are not signed in
        // So return the login view, that will call getScopedAutoRoot again after login
        const reactiveSession = session;

        return await wrapContext(reactiveSession, 'auto',
            new ComponentWithProperties(AuthenticatedView, {
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        if (reactiveSession.user) {
                            // Replace itself again after a successful login
                            const root = await getScopedAutoRoot(reactiveSession, options);
                            await ReplaceRootEventBus.sendEvent('replace', root);
                        }
                        else {
                            throw new SimpleError({
                                code: 'infinite_redirect',
                                message: $t('Er ging iets mis: te veel doorverwijzingen.'),
                            });
                        }
                        return new ComponentWithProperties({}, {});
                    },
                }),
                loginRoot: wrapWithModalStack(getLoginRoot()),
            }),
        );
    }

    if (STAMHOOFD.singleOrganization && !session.organization) {
        // Try to load the default organization
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }

    // Load the platform manager so we can calculate permissions correctly
    await PlatformManager.createFromCache(session, 'auto', true);

    // Make sure users without permissions always go to the member portal automatically
    if (
        (
            (!session.organization && session.auth.userPermissions?.isEmpty) // note: we cannot use .isEmpty because the platform is not yet loaded and we cannot detect inheritance
            || (session.organization && session.auth.permissions?.isEmpty)
        ) && (
            STAMHOOFD.userMode === 'platform'
            || (session.organization && session.organization.meta.packages.useMembers)
        )
    ) {
        const registration = await import('@stamhoofd/registration');
        return await registration.getRootView(session);
    }

    if (session.organization) {
        return await getScopedDashboardRoot(session, options);
    }

    // Users with permissions should always have the option to choose the member portal or the dashboard
    return getOrganizationSelectionRoot(session);
}

export async function getScopedDashboardRoot(reactiveSession: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "StartView", webpackPrefetch: true */ './views/start/StartView.vue'), {}),
    });

    setTitleSuffix(reactiveSession.organization?.name ?? '');

    const startTab = new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView,
    });

    const membersTab = new TabBarItem({
        icon: 'group',
        name: 'Leden',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/members/MembersMenu.vue'), {}),
        }),
    });

    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: 'Activiteiten',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const webshopsTab = new TabBarItem({
        icon: 'basket',
        name: 'Verkoop',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/webshops/WebshopsMenu.vue'), {}),
        }),
    });

    const whatsNewBadge = ref('');

    const loadWhatsNew = () => {
        const currentCount = localStorage.getItem('what-is-new');
        if (currentCount) {
            const c = parseInt(currentCount);
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                whatsNewBadge.value = (WhatsNewCount - c).toString();
            }
        }
        else {
            localStorage.setItem('what-is-new', (WhatsNewCount as any).toString());
        }
    };
    loadWhatsNew();

    const settingsTab = new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/SettingsView.vue'), {}),
        }),
    });

    const financesTab = new TabBarItem({
        icon: 'calculator',
        name: 'Boekhouding',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/FinancesView.vue'), {}),
        }),
    });

    const documentsTab = new TabBarItem({
        icon: 'file-filled',
        name: 'Documenten',
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/documents/DocumentTemplatesView.vue'), {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        icon: 'history',
        name: 'Logboek',
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const sharedMoreItems: TabBarItem[] = [];

    if (STAMHOOFD.CHANGELOG_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                icon: 'gift',
                name: 'Wat is er nieuw?',
                badge: whatsNewBadge,
                action: async function () {
                    window.open(STAMHOOFD.CHANGELOG_URL![STAMHOOFD.fixedCountry ?? reactiveSession.organization?.address?.country ?? ''] ?? STAMHOOFD.CHANGELOG_URL![''], '_blank');
                    whatsNewBadge.value = '';
                    localStorage.setItem('what-is-new', WhatsNewCount.toString());
                },
            }),
        );
    }

    if (STAMHOOFD.domains.documentation) {
        sharedMoreItems.push(
            new TabBarItem({
                icon: 'book',
                name: 'Documentatie',
                action: async function () {
                    window.open('https://' + LocalizedDomains.documentation, '_blank');
                },
            }),
        );
    }

    if (STAMHOOFD.NOLT_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                icon: 'feedback',
                name: 'Feedback',
                action: async function () {
                    const NoltHelper = (await import('./classes/NoltHelper'));
                    await NoltHelper.openNolt(reactiveSession, false);
                },
            }),
        );
    }

    // todo: accept terms view
    // if (this.fullAccess && !this.$organization.meta.didAcceptLatestTerms) {
    //     // Show new terms view if needed
    //     LoadComponent(() => import(/* webpackChunkName: "AcceptTermsView" */ "./AcceptTermsView.vue"), {}, { instant: true }).then((component) => {
    //         this.present(component.setDisplayStyle("popup").setAnimated(false))
    //     }).catch(console.error)
    // }

    return wrapContext(reactiveSession, 'dashboard',
        ({ platformManager }) => new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: computed(() => {
                        const organization = reactiveSession.organization;

                        const tabs: (TabBarItem | TabBarItemGroup)[] = [
                            startTab,
                        ];

                        if (organization?.meta.packages.useMembers) {
                            tabs.push(membersTab);
                        }

                        if (platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', reactiveSession)) {
                            tabs.push(calendarTab);
                        }

                        if (organization?.meta.packages.useWebshops && STAMHOOFD.domains.webshop) {
                            if (reactiveSession.auth.hasAccessRight(AccessRight.OrganizationCreateWebshops) || !!organization.webshops.find(w => reactiveSession.auth.canAccessWebshop(w, PermissionLevel.Read))) {
                                tabs.push(webshopsTab);
                            }
                        }

                        const moreTab = new TabBarItemGroup({
                            icon: 'category',
                            name: 'Meer',
                            items: [
                                ...sharedMoreItems, // need to create a new array, don't pass directly!
                            ],
                        });

                        if (reactiveSession.auth.hasFullAccess()) {
                            if (manualFeatureFlag('audit-logs', reactiveSession)) {
                                moreTab.items.unshift(auditLogsTab);
                            }
                            moreTab.items.unshift(documentsTab);
                            moreTab.items.unshift(financesTab);
                            moreTab.items.unshift(settingsTab);
                        }
                        else if (reactiveSession.auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                            moreTab.items.unshift(financesTab);
                        }

                        if (moreTab.items.length > 0) {
                            tabs.push(moreTab);
                        }

                        return tabs;
                    }),
                }),
            ),
            loginRoot: wrapWithModalStack(getNonAutoLoginRoot(reactiveSession, options)),
            noPermissionsRoot: getNoPermissionsView(),
        }),
        options,
    );
}
