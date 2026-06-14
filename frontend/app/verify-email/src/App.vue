<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';


const props = defineProps<{
    token: string;
    email: string;
    code?: string;
}>();

const token = props.token;
const code = props.code;
const email = props.email;

const root = AsyncComponent(() => import('./VerifyEmailView.vue'), {
    token,
    code,
    email,
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

</script>
