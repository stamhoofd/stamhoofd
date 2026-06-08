<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="context-provider-view" :data-organization-scope="organizationId ?? 'null'">
        <ComponentWithPropertiesInstance :key="root.key" :component="root" />
    </div>
</template>

<script setup lang="ts">
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { computed, isReactive, provide } from 'vue';

const props = withDefaults(defineProps<{
    root: ComponentWithProperties;
    context?: Record<string, unknown>;
}>(), {
    context: () => ({}),
});

if (isReactive(props.context)) {
    // If props.context is a proxy, it will auto unwrap all the reference properties it has
    // which will break reactivity on scalar values (e.g. Computed<null> will be unwrapped to null)
    throw new Error('ContextProvider.context is reactive, which will break reactivity of the context properties');
}

if (!props.context.stamhoofd_app) {
    console.error('Missing stamhoofd_app in ContextProvider.context');
} else if (!props.context.$context) {
    console.error('Missing $context in ContextProvider.context');
}

const organizationId = computed(() => (props.context.$context as any)?.organization?.id);

for (const key in props.context) {
    provide(key, props.context[key]);
}

if (props.root) {
    props.root.assignHistoryIndex();
}

async function shouldNavigateAway() {
    return await props.root.shouldNavigateAway();
}

function returnToHistoryIndex() {
    if (props.root) {
        return props.root.returnToHistoryIndex();
    }
    return false;
}

defineExpose({
    shouldNavigateAway,
    returnToHistoryIndex,
});
</script>
