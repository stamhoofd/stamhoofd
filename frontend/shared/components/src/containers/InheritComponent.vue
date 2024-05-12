<template>
    <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
</template>

<script setup lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { computed, inject, Ref, unref } from 'vue';

// The InheritComponent allows you to define comonents in the 'provide' context tree, and display one of those components if it is present
// This allows you to keep logic outside of components and 'inject' them

const props = defineProps<{
    name: string,
    overrideProps?: Record<string, any>
}>()

const injectedComponents = inject('reactive_components') as Ref<Record<string, ComponentWithProperties>|undefined> | undefined;
const root = computed(() => {
    const injected = unref(injectedComponents);
    if (injected && injected[props.name]) {
        // We need to clone here, because the component might be in multiple places
        const unreffed = unref(injected[props.name])
        const c = unreffed?.clone() ?? null
        if (c) {
            if (props.overrideProps) {
                c.properties = {
                    ...c.properties,
                    ...props.overrideProps
                }
            }
            return c
        }
    }
    return null
})

</script>
