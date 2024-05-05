<template>
    <OrganizationAvatar v-if="organization" :organization="organization" />
    <Logo v-else />
</template>

<script setup lang="ts">
import { Organization } from "@stamhoofd/structures";
import Logo from "../icons/Logo.vue";
import OrganizationAvatar from "./OrganizationAvatar.vue";
import { AppType } from "./appContext";

defineProps<{
    organization: Organization|undefined|null,
    app: AppType|'auto'
}>();

</script>