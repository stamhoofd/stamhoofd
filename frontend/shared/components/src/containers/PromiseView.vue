<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="promise-view">
        <LoadingViewTransition :error-box="errorBox" :view="view">
            <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" v-bind="$attrs" />
        </LoadingViewTransition>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance, useAnimateHeightChange, useContentState, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import { nextTick, onMounted, ref, shallowRef } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import LoadingViewTransition from './LoadingViewTransition.vue';

const props = withDefaults(
    defineProps<{
        promise: () => Promise<ComponentWithProperties>;
        view?: boolean;
    }>(),
    {
        view: true,
    },
);

const root = shallowRef<ComponentWithProperties | null>(null);
const errorBox = ref<ErrorBox | null>(null);
const component = useCurrentComponent();

let passRoutes = component?.checkRoutes ?? false;

// In view mode we tell the navigation controller we have no content yet while loading, so it keeps
// the sheet height frozen instead of collapsing to the empty loading placeholder.
const setHasContent = useContentState();

if (props.view) {
    setHasContent(false);
}

const animateHeightChange = useAnimateHeightChange();

/**
 * Apply a change that swaps the loading placeholder for real content (or an error).
 * - View mode: signal the controller it now has content so it can measure/animate.
 * - Box mode: animate the surrounding controller's height around the change.
 */
function applyContentChange(change: () => void) {
    if (!props.view) {
        animateHeightChange(change).catch(console.error);
        return;
    }

    console.log('Applying content change');

    change();
    // Wait for the real content to render before signaling so the controller can measure it.
    nextTick(async () => {
        requestAnimationFrame(() => {
            console.info('Promise view setting has content', true);
            setHasContent(true);
        });
    }).catch(console.error);
}

function run() {
    errorBox.value = null;
    props.promise().then(async (value) => {
        if (!value) {
            console.error('Promise view did not return a component.');
            throw new Error('Missing component in promise');
        }

        console.log('Promise view resolved');

        const c = value;
        if (passRoutes) {
            passRoutes = false;
            c.setCheckRoutes();
        }
        if (component && component.historyIndex !== null && component.ownsHistoryIndex()) {
            // Transfer ownership to child
            c.historyIndex = component.historyIndex;
            ComponentWithProperties.historyIndexOwners.set(component.historyIndex.index, c);
        }
        applyContentChange(() => {
            console.log('Resolved', c);
            root.value = c;
        });
    }).catch((e) => {
        console.error(e);
        console.error('Promise error not caught, defaulting to dismiss behaviour in PromiseView');

        // if (canDismiss.value) {
        //    Toast.fromError(e).show();
        //    dismiss({ force: true }).catch(console.error);
        // } else {
        applyContentChange(() => {
            errorBox.value = new ErrorBox(e);
        });
        // }
    });
}

function reload() {
    console.info('Reloading PromiseView');
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
