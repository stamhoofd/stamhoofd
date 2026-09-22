<template>
    <MetaLogo data-testid="organization-logo" :meta-data="identity.metaData" :name="identity.name" />
</template>

<script lang="ts" setup>
import { getWebshopIdentity } from '#helpers/webshopIdentity.ts';
import type { Organization, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';

import MetaLogo from '../MetaLogo.vue';

const props = withDefaults(defineProps<{
    organization: Organization;
    webshop?: Webshop | null;
}>(), {
    webshop: null,
});

const identity = computed(() => getWebshopIdentity(props.organization, props.webshop));
</script>
