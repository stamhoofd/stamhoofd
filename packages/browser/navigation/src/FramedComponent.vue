<template>
    <div>
        <div>
            <ComponentWithPropertiesInstance :component="root" v-bind="$attrs" />
        </div>
    </div>
</template>

<script lang="ts">

import { ComponentWithProperties } from './ComponentWithProperties';
import ComponentWithPropertiesInstance from './ComponentWithPropertiesInstance.js';

export default {
    name: 'FramedComponent',
    components: {
        ComponentWithPropertiesInstance,
    },
    provide() {
        return {
            ...(this.customProvide ?? {}),
        };
    },
    props: {
        root: {
            type: ComponentWithProperties,
            required: true,
        },
        customProvide: {
            type: Object,
            default: null,
        },
    },
    emits: ['show', 'push', 'pop'],
};
</script>
