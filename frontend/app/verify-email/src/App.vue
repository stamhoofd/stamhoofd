<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import BoxedController from '@stamhoofd/components/containers/BoxedController.vue';
import VerifyEmailView from './VerifyEmailView.vue';

const props = defineProps<{
    token: string;
    email: string;
    code?: string;
}>();

const token = props.token;
const code = props.code;
const email = props.email;

// eslint-disable-next-line stamhoofd/async-component-with-properties
const root = new ComponentWithProperties(BoxedController, {
    // eslint-disable-next-line stamhoofd/async-component-with-properties
    root: new ComponentWithProperties(VerifyEmailView, {
        token,
        code,
        email,
    }),
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

</script>
