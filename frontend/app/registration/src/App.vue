<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent, NavigationController, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import { useLoginRoot } from '@stamhoofd/components/auth/useLoginRoot.ts';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem } from '@stamhoofd/components/containers/TabBarItem.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useEventTypes } from '@stamhoofd/components/hooks/useEventTypes.ts';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import { useMembersPackage } from '@stamhoofd/components/hooks/useMembersPackage.ts';
import { computed } from 'vue';
import { useAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate.ts';
import { AppRoute } from '@stamhoofd/structures';

const context = useContext();
const memberManager = useMemberManager();
const getLoginRoot = useLoginRoot();
const eventTypes = useEventTypes();
const membersPackage = useMembersPackage();
const appNavigate = useAppNavigate();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    loginRoot: getLoginRoot(),
    root: wrapWithModalStack(getRoot()),
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

function areEventsEnabled(): boolean {
    return eventTypes.value.length > 0 && !manualFeatureFlag('disable-events', context.value);
}

function getRoot() {
    if (STAMHOOFD.userMode === 'organization' && !membersPackage.value) {
        console.warn('No members package found for org ' + context.value.organization?.name + ', navigating to dashboard');
        return new ComponentWithProperties(PromiseView, {
            promise: async () => {
                await appNavigate(AppRoute.Dashboard, { properties: { organization: context.value.organization } });
                throw new Error('Should have been navigated away');
            },
        });
    }
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {}),
    });

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/cart/CartView.vue'), {}),
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./views/events/EventsOverview.vue'), {}),
        }),
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./views/communication/MemberCommunicationView.vue'), {}),
        }),
    });

    return new ComponentWithProperties(PromiseView, {
        promise: async function () {
            await memberManager.loadMembers();
            await memberManager.loadCheckout();
            await memberManager.loadDocuments();

            return new ComponentWithProperties(TabBarController, {
                tabs: [
                    new TabBarItem({
                        id: 'start',
                        icon: 'home',
                        name: $t(`%I`),
                        component: startView,
                    }),
                    ...(areEventsEnabled() ? [calendarTab] : []),
                    communicationTab,
                    new TabBarItem({
                        id: 'cart',
                        icon: 'basket',
                        name: $t(`%X5`),
                        component: cartRoot,
                        badge: computed(() => memberManager.family.checkout.cart.count === 0 ? '' : memberManager.family.checkout.cart.count.toFixed(0)),
                    }),
                ],
            });
        },
    });
}
</script>
