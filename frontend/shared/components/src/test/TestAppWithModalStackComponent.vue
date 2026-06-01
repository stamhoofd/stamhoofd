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
import type { PushOptions} from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, useManualPresent } from '@simonbackx/vue-app-navigation';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import CenteredMessageView from '@stamhoofd/components/overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import { OrganizationManager, PlatformManager, SessionContext } from '@stamhoofd/networking';
import type { Ref } from 'vue';
import { markRaw, onMounted, ref } from 'vue';
import { Platform } from '@stamhoofd/structures';
import ToastBox from '@stamhoofd/components/overlays/ToastBox.vue';

const props = withDefaults(defineProps<{
    root: ComponentWithProperties;
    keepAlive?: boolean;
}>(), {
    keepAlive: true,
});
const context = new SessionContext(null);
const platformManager = new PlatformManager(context, Platform.create({}), 'auto');

const wrappedRoot = new ComponentWithProperties(ContextProvider, {
    context: markRaw({
        $context: new SessionContext(null),
        $platformManager: platformManager,
        //$memberManager,
        $organizationManager: new OrganizationManager(context),
        //$webshopManager,
        //$checkoutManager,
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
