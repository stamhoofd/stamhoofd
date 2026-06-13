<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="authenticated-view">
        <LoadingViewTransition :error-box="errorBox">
            <template v-if="!preventComplete">
                <ComponentWithPropertiesInstance v-if="loggedIn" :key="root.key" :component="root" />
                <ComponentWithPropertiesInstance v-else-if="noPermissionsRoot && showPermissionsRoot" :key="noPermissionsRoot.key" :component="noPermissionsRoot" />
                <ComponentWithPropertiesInstance v-else-if="!hasToken" :key="loginRoot.key" :component="loginRoot" />
            </template>
        </LoadingViewTransition>
    </div>
</template>

<script lang="ts" setup>
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { onBeforeUnmount, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useContext } from '../hooks/useContext';
import LoadingViewTransition from './LoadingViewTransition.vue';

const props = defineProps<{
    root: ComponentWithProperties;
    loginRoot: ComponentWithProperties;
    /**
     * Set this as the root when the user doesn't have permissions (don't set if permissions are not needed)
     */
    noPermissionsRoot?: ComponentWithProperties | null;
}>();

const context = useContext() as { value: SessionContext };
const loggedIn = ref(false);
const userId = ref<string | null>(null);
const hasToken = ref(false);
const showPermissionsRoot = ref(false);
const lastOrganizationFetch = ref(new Date());
const errorBox = ref<ErrorBox | null>(null);
const preventComplete = ref(false);
const listenerOwner = {};

function changed() {
    if (props.noPermissionsRoot) {
        loggedIn.value = (context.value.isComplete() ?? false) && !!context.value.auth.permissions && !context.value.auth.permissions?.isEmpty;
        hasToken.value = context.value.hasToken() ?? false;
        showPermissionsRoot.value = context.value.isComplete() ?? false;
    } else {
        loggedIn.value = context.value.isComplete() ?? false;
        hasToken.value = context.value.hasToken() ?? false;
        showPermissionsRoot.value = false;
    }
    userId.value = context.value.user?.id ?? null;
    errorBox.value = context.value.loadingError ? new ErrorBox(context.value.loadingError) : null;
    preventComplete.value = context.value.preventComplete ?? false;
}

function onVisibilityChange() {
    if (document.visibilityState !== 'visible') {
        return;
    }

    console.info('Window became visible again');

    if (!context.value || !context.value.isComplete()) {
        return;
    }

    if (STAMHOOFD.environment === 'development' || lastOrganizationFetch.value.getTime() + 1000 * 60 * 5 < Date.now()) {
        console.info('Updating organization');
        lastOrganizationFetch.value = new Date();
        context.value.updateData(true, false, false).catch(console.error);
    }
}

changed();
context.value.addListener(listenerOwner, changed);
document.addEventListener('visibilitychange', onVisibilityChange);

onBeforeUnmount(() => {
    context.value.removeListener(listenerOwner);
    document.removeEventListener('visibilitychange', onVisibilityChange);
});

async function shouldNavigateAway() {
    if (loggedIn.value) {
        return await props.root.shouldNavigateAway();
    }
    if (props.noPermissionsRoot && showPermissionsRoot.value) {
        return await props.noPermissionsRoot.shouldNavigateAway();
    }
    if (!hasToken.value) {
        return await props.loginRoot.shouldNavigateAway();
    }
    return true;
}

defineExpose({ shouldNavigateAway });
</script>
