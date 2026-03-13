<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions, useManualPresent } from '@simonbackx/vue-app-navigation';
import { getScopedAdminRootFromUrl } from '@stamhoofd/admin-frontend';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import CenteredMessageView from '@stamhoofd/components/overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ToastBox from '@stamhoofd/components/overlays/ToastBox.vue';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Storage } from '@stamhoofd/networking/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import { getScopedRegistrationRootFromUrl } from '@stamhoofd/registration';
import { Country, EmailAddressSettings, Language, Platform, uriToApp } from '@stamhoofd/structures';
import { nextTick, onMounted, Ref, ref } from 'vue';
import { getScopedAutoRoot, getScopedAutoRootFromUrl, getScopedDashboardRootFromUrl } from './getRootViews';

const modalStack = ref(null) as Ref<InstanceType<typeof ModalStackComponent> | null>;
HistoryManager.activate();
HistoryManager.debug = STAMHOOFD.environment === 'test';

const root = new ComponentWithProperties(PromiseView, {
    promise: async () => {
        // Load locales first
        try {
            await I18nController.loadDefault(null, Country.Belgium, Language.Dutch);
        }
        catch (e) {
            console.error('Failed to load default locale', e);
        }

        try {
            let app: 'dashboard' | 'admin' | 'registration' | 'auto' = 'auto';

            let parts = UrlHelper.shared.getParts();

            // Check mollie oauth redirect replacement
            // We cannot customize the redirect url for Mollie, but that causes us not to know to which organization url we need to redirect after oauth
            if (parts[0] === 'oauth' && parts[1] === 'mollie') {
                const savedRedirectUrl = await Storage.keyValue.getItem('mollie-saved-redirect-url');
                if (savedRedirectUrl) {
                    // Redirect to the saved URL (removing /oauth/mollie)
                    UrlHelper.shared.url.pathname = savedRedirectUrl;
                    console.log('Redirecting to saved mollie redirect url', savedRedirectUrl);
                    parts = UrlHelper.shared.getParts();
                }
                else {
                    console.warn('No saved mollie redirect url found');
                }
            }

            if (parts.length >= 1) {
                app = uriToApp(parts[0]);
            }
            else {
                app = 'auto';
            }

            let component: ComponentWithProperties;
            if (app === 'auto') {
                component = (await getScopedAutoRootFromUrl());
            }
            else if (app === 'dashboard') {
                component = (await getScopedDashboardRootFromUrl());
            }
            else if (app === 'admin') {
                component = (await getScopedAdminRootFromUrl({ $t }));
            }
            else {
                component = (await getScopedRegistrationRootFromUrl());
            }

            console.log('Resolved root component');
            return component;
        }
        catch (e) {
            console.error('Error in dashboard.App promise', e);
            Toast.fromError(e).setHide(null).show();
            throw e;
        }
    },
}).setCheckRoutes();

async function checkGlobalRoutes() {
    if (!modalStack.value) {
        await nextTick();
        return await checkGlobalRoutes();
    }

    const currentPath = UrlHelper.initial.getPath({ removeLocale: true });
    const parts = UrlHelper.initial.getParts();
    const queryString = UrlHelper.initial.getSearchParams();
    console.log('check global routes', parts, queryString, currentPath);

    if (parts.length === 1 && parts[0] === 'unsubscribe') {
        const id = queryString.get('id');
        const token = queryString.get('token');
        const type = queryString.get('type') ?? 'all';

        if (id && token && ['all', 'marketing'].includes(type)) {
            await unsubscribe(id, token, type as 'all' | 'marketing');
        }
    }

    if (parts.length >= 1 && parts[0] === 'verify-email') {
        const token = queryString.get('token');
        const code = queryString.get('code');

        if (token && code) {
            const toast = new Toast($t(`%IZ`), 'spinner').setHide(null).show();

            try {
                const session = parts[1] ? await SessionContext.createFrom({ organizationId: parts[1] }) : new SessionContext(null);
                await session.loadFromStorage();
                await LoginHelper.verifyEmail(session, code, token);
                toast.hide();
                new Toast($t(`%Ia`), 'success green').show();

                const dashboardContext = await getScopedAutoRoot(session);
                await ReplaceRootEventBus.sendEvent('replace', dashboardContext);
            }
            catch (e) {
                toast.hide();
                CenteredMessage.fromError(e).addCloseButton().show();
            }
        }
    }
}
const manualPresent = useManualPresent();

onMounted(async () => {
    if (!modalStack.value) {
        throw new Error('Modal stack not loaded');
    }

    const stack = modalStack.value;

    ModalStackEventBus.addListener(this, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            await manualPresent(stack.present, { components: [options as ComponentWithProperties] });
        }
        else {
            await manualPresent(stack.present, options);
        }
    });

    ReplaceRootEventBus.addListener(this, 'replace', async (component: ComponentWithProperties) => {
        component.setCheckRoutes();
        stack.replace(component, false);
    });

    CenteredMessage.addListener(this, async (centeredMessage) => {
        await manualPresent(stack.present, {
            components: [
                new ComponentWithProperties(CenteredMessageView, {
                    centeredMessage,
                }, {
                    forceCanHaveFocus: true,
                }),
            ],
            modalDisplayStyle: 'overlay',
        });
    });

    // First check updates, and only after that, check for global routes
    // reason: otherwise the checkUpdates will dismiss the modal stack, and that can hide the reset password view instead of the update view
    try {
        await AppManager.shared.checkUpdates({
            visibleCheck: 'spinner',
            visibleDownload: true,
            installAutomatically: true,
        });
    }
    catch (e) {
        console.error(e);
    }

    // Check routes
    checkGlobalRoutes().catch(console.error);
});

async function unsubscribe(id: string, token: string, type: 'all' | 'marketing') {
    const toast = new Toast($t(`%Ib`), 'spinner').setHide(null).show();

    try {
        const response = await NetworkManager.server.request({
            method: 'GET',
            path: '/email/manage',
            query: {
                id,
                token,
            },
            decoder: EmailAddressSettings as Decoder<EmailAddressSettings>,
        });

        const details = response.data;
        toast.hide();

        let unsubscribe = true;
        const fieldName = type === 'all' ? 'unsubscribedAll' : 'unsubscribedMarketing';

        if (details[fieldName]) {
            if (!await CenteredMessage.confirm($t(`%Ic`), $t(`%Id`), $t(`%Ie`, { name: details.organization?.name ?? Platform.shared.config.name, email: details.email, complaintEmail: $t('%W') }))) {
                return;
            }

            unsubscribe = false;
        }
        else {
            if (!await CenteredMessage.confirm($t(`%If`), $t(`%Ig`), $t(`%Ih`, { name: details.organization?.name ?? Platform.shared.config.name, email: details.email }))) {
                return;
            }
            toast.show();
        }

        await NetworkManager.server.request({
            method: 'POST',
            path: '/email/manage',
            body: {
                id,
                token,
                [fieldName]: unsubscribe,
            },
        });
        toast.hide();

        if (unsubscribe) {
            new Toast($t(`%Ii`), 'success').setHide(15 * 1000).show();
        }
        else {
            new Toast($t(`%Ij`), 'success').setHide(15 * 1000).show();
        }
    }
    catch (e) {
        console.error(e);
        toast.hide();
        Toast.fromError(e).show();
    }
}

</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@use "@stamhoofd/scss/base/dark-modus";
@use "@simonbackx/vue-app-navigation/dist/main.css" as VueAppNavigation;

html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
