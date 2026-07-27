<template>
    <div id="app">
        <KeepAlive>
            <template v-if="keepAlive">
                <ModalStackComponent ref="modalStack" :root="wrappedRoot" />
            </template>
        </KeepAlive>
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import type { PushOptions } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, useManualPresent } from '@simonbackx/vue-app-navigation';
import ContextProvider from '#containers/ContextProvider.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import CenteredMessageView from '#overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '#overlays/ModalStackEventBus.ts';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { ThemeManager } from '@stamhoofd/networking/ThemeManager';
import { Platform } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { markRaw, onMounted, ref } from 'vue';
import ToastBox from '#overlays/ToastBox.vue';

const props = withDefaults(defineProps<{
    root: ComponentWithProperties;
    keepAlive?: boolean;
}>(), {
    keepAlive: true,
});
const platform = Platform.create({});
const context = new SessionContext(null, platform);
const themeManager = new ThemeManager(context, 'auto');

const wrappedRoot = new ComponentWithProperties(ContextProvider, {
    context: markRaw({
        $context: new SessionContext(null, platform),
        $themeManager: themeManager,
        // $memberManager,
        $organizationManager: new OrganizationManager(context),
        // $webshopManager,
        // $checkoutManager,
        stamhoofd_app: 'auto',
    }),
    root: props.root,
});

const modalStack = ref(null) as Ref<InstanceType<typeof ModalStackComponent> | null>;
HistoryManager.activate();

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
