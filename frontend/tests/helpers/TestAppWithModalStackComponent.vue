<template>
    <div id="app">
        <KeepAlive>
            <template v-if="keepAlive">
                <ModalStackComponent ref="modalStack" :root="root" />
            </template>
        </KeepAlive>
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions, useManualPresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, CenteredMessageView, ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components';
import { onMounted, Ref, ref } from 'vue';

withDefaults(defineProps<{
    root: ComponentWithProperties;
    keepAlive?: boolean;
}>(), {
    keepAlive: true
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
            await manualPresent(stack.present, { components: [options] });
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
@import "@stamhoofd/scss/base/dark-modus";
@import "@simonbackx/vue-app-navigation/dist/main.css";

html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
