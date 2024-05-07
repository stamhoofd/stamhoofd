<template>
    <div class="context-logo">
        <OrganizationAvatar v-if="organization" :organization="organization" />
        <Logo v-else class="small" />
    </div>
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


<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.context-logo {
    width: var(--block-width, 40px);
    height: var(--block-width, 40px);
    border-radius: $border-radius;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    > .stamhoofd-logo-container.small {
        display: block;

        > .stamhoofd-logo:last-child {
            display: block;
        }
    }
}

</style>