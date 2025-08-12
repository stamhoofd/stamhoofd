<template>
    <div class="calculator-app-root">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, HistoryManager, ModalStackComponent, NavigationController, PushOptions, useManualPresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, CenteredMessageView, ModalStackEventBus, ToastBox } from '@stamhoofd/components';

import { getCurrentInstance, onMounted, ref, watch } from 'vue';
import CalculatorView from './CalculatorView.vue';
const root = new ComponentWithProperties(NavigationController, {
    root: new ComponentWithProperties(CalculatorView, {}),
});
import webfontsString from 'virtual:vite-svg-2-webfont.css?inline';

console.log('Webfonts string:', webfontsString);

const boundaryString = '/** @preserve SHADOW-DOM */';

// And as a bit of a unique situation, we also need to register the font outside of the shadow DOM
const splitted = webfontsString.split(boundaryString);
const fontFaceDefinition = splitted.shift()!;
const restOfCss = splitted.join('\n');

// Get shadow dom and inject a new style element with webfontsString as content
const instance = getCurrentInstance();
onMounted(() => {
    const shadowRoot = instance?.proxy?.$el?.parentNode;
    if (shadowRoot) {
        const styleElement = document.createElement('style');
        styleElement.textContent = restOfCss;
        shadowRoot.appendChild(styleElement);
    }
    console.log('Shadow root found, injected webfonts style.', instance?.proxy?.$el.parentNode, shadowRoot);

    // Now inject the font face definition into the global document
    const globalStyleElement = document.createElement('style');
    globalStyleElement.textContent = fontFaceDefinition;
    document.head.appendChild(globalStyleElement);
    console.log('Injected webfonts style into global document.');
});

const owner = {};

const modalStack = ref<typeof ModalStackComponent | null>(null);

const manualPresent = useManualPresent();

watch(modalStack, (modalStack) => {
    if (modalStack === null) {
        return;
    }

    ModalStackEventBus.addListener(owner, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            modalStack.present({ components: [options] });
        }
        else {
            modalStack.present(options);
        }
    });

    CenteredMessage.addListener(owner, async (centeredMessage) => {
        await manualPresent(modalStack.present, {
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
@use "@simonbackx/vue-app-navigation/dist/main.css" as VueAppNavigation;
@use "@stamhoofd/scss/base/dark-modus";

#calculator-app {

    margin: 0;
    padding: 0;
    font-family: "Metropolis", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";

    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    -webkit-overflow-scrolling: auto;

    /* Disabel text resize as this doesn't work across animations */
    text-size-adjust: none;

    // Allow word break if it doesn't fit only
    word-break: break-word;

    will-change: scroll-position;

}

body {
    --st-sheet-width: 450px;
}

.calculator-app-root {
    > div > .navigation-controller {
        overflow: hidden;
        transition: height 0.25s cubic-bezier(0.4, 0.0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
        will-change: height, width;
        --st-horizontal-padding: 0px;

        .st-view, .payconiq-banner-view {
            contain: content;

            // Automatic height
            height: auto !important;
            min-height: 0 !important;
            max-height: calc(var(--vh, 1vh) * 100) !important;
            contain: content;
        }
    }
}
</style>
