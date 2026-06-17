<template>
    <MetaLogo data-testid="organization-logo" :meta-data="metaData" :name="name" />
</template>

<script lang="ts" setup>
import type { Organization, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';

import MetaLogo from '../MetaLogo.vue';

const props = withDefaults(defineProps<{
    organization: Organization;
    webshop?: Webshop | null;
}>(), {
    webshop: null,
});

const metaData = computed(() => {
    if (!props.webshop || !props.webshop.meta.useLogo) {
        return props.organization.meta;
    }
    return props.webshop.meta;
});

const name = computed(() => {
    if (!props.webshop || !props.webshop.meta.useLogo) {
        return props.organization.name;
    }
    return props.webshop.meta.name;
});
</script>
