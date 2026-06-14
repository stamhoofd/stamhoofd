<template>
    <ComponentWithPropertiesInstance v-if="loadedComponent" :key="loadedComponent.key" :component="loadedComponent" v-bind="$attrs" />
    <div v-else class="st-view import-error-view">
        <STNavigationBar :title="$t(`Geen internetverbinding`)" />
        <main class="center">
            <h1>{{ $t('Geen internetverbinding') }}</h1>
            <p>{{ $t('We konden deze pagina niet laden. Controleer je internetverbinding en probeer het opnieuw.') }}</p>

            <p>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="retry">
                        <span class="icon retry" />
                        <span>{{ $t('Opnieuw proberen') }}</span>
                    </button>
                </LoadingButton>
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { ref, shallowRef } from 'vue';

import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';

const props = defineProps<{
    /**
     * Loads the component that should replace this error view once the network is available again.
     * Typically includes its own retry-with-backoff behaviour (see importWithRetry).
     */
    load: () => Promise<ComponentWithProperties>;
}>();

const loadedComponent = shallowRef<ComponentWithProperties | null>(null);
const loading = ref(false);

async function retry() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        // On success this replaces the error view with the actual component.
        const c = await props.load();
        if (c instanceof ComponentWithProperties) {
            loadedComponent.value = c;
        } else {
            console.error('Unexpected load type. Expected ComponentWithProperties, received ', c);
            throw new Error('Unexpected load type');
        }
    } catch (e) {
        console.error(e);
        new Toast($t(`Nog steeds geen internetverbinding. Probeer het later opnieuw.`), 'error red').show();
    } finally {
        loading.value = false;
    }
}
</script>

<style lang="scss">
.import-error-view {
    .icon.retry {
        margin-right: 5px;
    }
}
</style>
