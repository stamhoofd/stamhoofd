<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import type { PushOptions } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, useManualPresent } from '@simonbackx/vue-app-navigation';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import CenteredMessageView from '@stamhoofd/components/overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ToastBox from '@stamhoofd/components/overlays/ToastBox.vue';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Storage } from '@stamhoofd/networking/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { onMounted, useTemplateRef } from 'vue';
import RouterAppView from './RouterAppView.vue';

const modalStack = useTemplateRef<InstanceType<typeof ModalStackComponent>>('modalStack');
HistoryManager.activate();
HistoryManager.debug = STAMHOOFD.environment === 'test';

if (STAMHOOFD.environment === 'development') {
    Error.stackTraceLimit = Infinity; // unlimited stack trace to debug infinite loops
}

const root = new ComponentWithProperties(PromiseView, {
    promise: async () => {
        // Load locales first
        try {
            await I18nController.loadDefault(null, Country.Belgium, Language.Dutch);
        } catch (e) {
            console.error('Failed to load default locale', e);
        }

        try {
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
                } else {
                    console.warn('No saved mollie redirect url found');
                }
            }

            // eslint-disable-next-line stamhoofd/async-component-with-properties
            return new ComponentWithProperties(RouterAppView, {}, {
                // Don't delete the navigation routes when we unmount it
                // for now this happens because we'll replace it (need to think how to solve this better in the future)
                keepNavigationRoutes: true,
            });
        } catch (e) {
            console.error('Error in web-app.App promise', e);
            Toast.fromError(e).setHide(null).show();
            throw e;
        }
    },
}).setCheckRoutes();

const manualPresent = useManualPresent();

onMounted(async () => {
    if (!modalStack.value) {
        throw new Error('Modal stack not loaded');
    }

    const stack = modalStack.value;
    ModalStackEventBus.addListener(this, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            await manualPresent(stack.present, { components: [options as ComponentWithProperties] });
        } else {
            await manualPresent(stack.present, options);
        }
    });

    ReplaceRootEventBus.addListener(this, 'replace', async (component: ComponentWithProperties) => {
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
            invalidHistory: true,
        });
    });
});

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
