<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
    </div>
</template>

<script lang="ts" setup>
import type { PushOptions } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, ModalStackComponent, useManualPresent } from '@simonbackx/vue-app-navigation';
import { MobileRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { App as WebApp } from '@stamhoofd/web-app';
import { onMounted, useTemplateRef } from 'vue';

const modalStack = useTemplateRef<InstanceType<typeof ModalStackComponent>>('modalStack');
const root = new ComponentWithProperties(WebApp, {}).setCheckRoutes();
const manualPresent = useManualPresent();

onMounted(async () => {
    if (!modalStack.value) {
        throw new Error('Modal stack not loaded');
    }

    const stack = modalStack.value;
    MobileRootEventBus.addListener(this, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            await manualPresent(stack.present, { components: [options as ComponentWithProperties] });
        } else {
            await manualPresent(stack.present, options);
        }
    });

    // First check updates, and only after that, check for global routes
    // reason: otherwise the checkUpdates will dismiss the modal stack, and that can hide the reset password view instead of the update view
    try {
        if (STAMHOOFD.userMode === 'organization' && STAMHOOFD.platformName.toLocaleLowerCase() === 'stamhoofd' && STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL && new Date() < new Date('2026-06-22T23:59:00+02:00')) {
            // Since the backend is not compatible with the new app, before launch date we need a different app bundle.
            await AppManager.shared.checkUpdates({
                visibleCheck: 'spinner',
                visibleDownload: true,
                installAutomatically: true,
                force: true,
                channel: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL,
                checkTimeout: 15 * 1000,
            });
        } else {
            await AppManager.shared.checkUpdates({
                visibleCheck: 'spinner',
                visibleDownload: true,
                installAutomatically: true,
            });
        }
    } catch (e) {
        console.error(e);
    }
});

</script>
