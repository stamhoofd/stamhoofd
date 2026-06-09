<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="promise-view">
        <LoadingViewTransition :error-box="errorBox">
            <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
        </LoadingViewTransition>
    </div>
</template>

<script setup lang="ts">
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { ComponentWithPropertiesInstance, useCanDismiss, useCurrentComponent, useDismiss } from '@simonbackx/vue-app-navigation';
import { onMounted, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { Toast } from '../overlays/Toast';
import LoadingViewTransition from './LoadingViewTransition.vue';

const props = defineProps<{
    promise: () => Promise<ComponentWithProperties>;
}>();

const root = ref<ComponentWithProperties | null>(null);
const errorBox = ref<ErrorBox | null>(null);
const component = useCurrentComponent();

let passRoutes = component?.checkRoutes ?? false;

const dismiss = useDismiss();
const canDismiss = useCanDismiss();

function run() {
    errorBox.value = null;
    props.promise().then((value) => {
        if (!value) {
            console.error('Promise view did not return a component.');
            throw new Error('Missing component in promise');
        }

        const c = value;
        if (passRoutes) {
            passRoutes = false;
            c.setCheckRoutes();
        }
        root.value = c;
    }).catch((e) => {
        console.error(e);
        console.error('Promise error not caught, defaulting to dismiss behaviour in PromiseView');

        if (canDismiss.value) {
            Toast.fromError(e).show();
            dismiss({ force: true }).catch(console.error);
        } else {
            errorBox.value = new ErrorBox(e);
        }
    });
}

function reload() {
    root.value = null;
    run();
}

function returnToHistoryIndex() {
    if (root.value) {
        return root.value.returnToHistoryIndex();
    }
    return false;
}

async function shouldNavigateAway(): Promise<boolean> {
    if (!root.value) {
        return true;
    }
    return await root.value.shouldNavigateAway();
}

onMounted(() => {
    run();
});

defineExpose({
    returnToHistoryIndex,
    reload,
    shouldNavigateAway,
});
</script>

<style lang="scss">

.promise-view.st-view {
    background: transparent; // Ticket scanning requires all views to be transparent
}
</style>
