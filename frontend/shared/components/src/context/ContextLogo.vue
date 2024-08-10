<template>
    <figure class="context-logo">
        <OrganizationAvatar v-if="organization" :organization="organization" />
        <PlatformAvatar v-else />
    </figure>
</template>

<script setup lang="ts">
import { Organization } from "@stamhoofd/structures";
import { AppType } from "./appContext";
import OrganizationAvatar from "./OrganizationAvatar.vue";
import PlatformAvatar from "./PlatformAvatar.vue";

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
