<template>
    <div data-testid="app-root-verify-email" style="display: contents">
        <ComponentWithPropertiesInstance :component="root" />
    </div>
</template>

<script lang="ts" setup>
import { useContext } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import VerifyEmailView from './VerifyEmailView.vue';
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';

const props = defineProps<{
    token?: string;
    email?: string;
    code?: string;
}>();

const context = useContext();

const searchParams = UrlHelper.shared.getSearchParams();
const token = props.token ?? searchParams.get('token') ?? '';
const code = props.code ?? searchParams.get('code') ?? undefined;
const email = props.email ?? context.value.user?.email ?? searchParams.get('email') ?? '';

const root = new ComponentWithProperties(VerifyEmailView, {
    token,
    code,
    email,
});
root.setCheckRoutes(); // DISCLAIMER waiting for upstream fix

</script>
