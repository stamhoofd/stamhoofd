import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from '@simonbackx/vue-app-navigation';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem } from '@stamhoofd/components/containers/TabBarItem.ts';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { getScopedAutoRootComponent, sessionFromOrganization, wrapContext } from '@stamhoofd/dashboard';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { Organization, uriToApp } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { computed } from 'vue';

import CartView from './views/cart/CartView.vue';
import MemberCommunicationView from './views/communication/MemberCommunicationView.vue';
import EventsOverview from './views/events/EventsOverview.vue';
import StartView from './views/start/StartView.vue';

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, { initialComponents: components });
}

export async function getScopedRegistrationRootFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'start', 'mandje', 'activiteiten'];

    let session: SessionContext | null = null;

    if (STAMHOOFD.singleOrganization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    else if (uriToApp(parts[0]) === 'registration' && parts[1] && !ignoreUris.includes(parts[1])) {
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
        }
    }

    if (!session || !session.organization) {
        if (STAMHOOFD.userMode === 'platform' && parts[0] && uriToApp(parts[0]) === 'registration') {
            session = new SessionContext(null);
            await session.loadFromStorage();
            await session.checkSSO();
            await SessionManager.prepareSessionForUsage(session, true);
            return await getRootView(session);
        }
        const dashboard = await import('@stamhoofd/dashboard');
        return dashboard.getOrganizationSelectionRoot(new SessionContext(null));
    }

    return await getRootView(session);
}

export async function getRootView(session: SessionContext, ownDomain = false) {
    if (STAMHOOFD.singleOrganization && !session.organization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    await I18nController.loadDefault(session, Country.Belgium, Language.Dutch, session?.organization?.address?.country);

    // Set color
    if (session.organization?.meta.color && ownDomain) {
        ColorHelper.setColor(session.organization?.meta.color);
    }

    const startView = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(StartView, {}),
    });

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(CartView, {}),
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventsOverview, {}),
        }),
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberCommunicationView, {}),
        }),
    });

    return wrapContext(session, 'registration', ({ platformManager }) => new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(
            new ComponentWithProperties(PromiseView, {
                promise: async function (this: PromiseView) {
                    const $memberManager = this.$memberManager;
                    await $memberManager.loadMembers();
                    await $memberManager.loadCheckout();
                    await $memberManager.loadDocuments();

                    const enableEvents = platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', session);

                    return new ComponentWithProperties(TabBarController, {
                        tabs: [
                            new TabBarItem({
                                id: 'start',
                                icon: 'home',
                                name: $t(`%I`),
                                component: startView,
                            }),
                            ...(enableEvents ? [calendarTab] : []),
                            communicationTab,
                            new TabBarItem({
                                id: 'cart',
                                icon: 'basket',
                                name: $t(`%X5`),
                                component: cartRoot,
                                badge: computed(() => $memberManager.family.checkout.cart.count === 0 ? '' : $memberManager.family.checkout.cart.count.toFixed(0)),
                            }),
                        ],
                    });
                },
            }),
        ),
        loginRoot: wrapWithModalStack(
            getScopedAutoRootComponent(session),
        ),
    }), { ownDomain });
}
