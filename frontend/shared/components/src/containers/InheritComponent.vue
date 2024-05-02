<template>
    <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
</template>

<script setup lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Ref, inject, ref, unref, watch } from 'vue';

// The InheritComponent allows you to define comonents in the 'provide' context tree, and display one of those components if it is present
// This allows you to keep logic outside of components and 'inject' them

const props = defineProps<{
    name: string
}>()

const injectedComponents = inject('reactive_components') as Ref<Record<string, ComponentWithProperties>|undefined> | undefined;
const root = ref(null) as Ref<ComponentWithProperties | null>

const updateRoot = () => {
    const injected = unref(injectedComponents)
    if (injected) {
        // We need to clone here, because the component might be in multiple places
        console.log('updateRoot', props.name, injected[props.name])
        root.value = injected[props.name]?.clone() ?? null
    } else {
        root.value = null
    }
}

watch(props, () => {
    updateRoot()
})
updateRoot();

</script>