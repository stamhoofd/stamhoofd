<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import VerifyEmailView from './VerifyEmailView.vue';

const props = defineProps<{
    token: string;
    email: string;
    code?: string;
}>();

const token = props.token;
const code = props.code;
const email = props.email;

const root = new ComponentWithProperties(VerifyEmailView, {
    token,
    code,
    email,
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

</script>
