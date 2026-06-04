<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { useContext } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import VerifyEmailView from './VerifyEmailView.vue';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

const context = useContext();

const searchParams = UrlHelper.shared.getSearchParams();
const token = searchParams.get('token') ?? '';
const code = searchParams.get('code') ?? undefined;
const email = context.value.user?.email ?? searchParams.get('email') ?? '';

const root = new ComponentWithProperties(VerifyEmailView, {
    token,
    code,
    email,
});
root.setCheckRoutes(); // DISCLAIMER waiting for upstream fix
</script>
