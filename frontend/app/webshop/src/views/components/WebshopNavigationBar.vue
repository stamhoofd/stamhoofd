<template>
    <STNavigationBar :large="true" :left-logo="true" :disable-pop="disablePop">
        <template #left>
            <OrganizationLogo :organization="organization" :webshop="webshop" />
        </template>

        <template #right>
            <button v-if="isLoggedIn" type="button" class="button text limit-space" @click="switchAccount">
                <span class="icon user" />
                <span>{{ userName }}</span>
            </button>
            <a v-else-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                <span class="icon external" />
                <span>{{ $t('%Xf') }}</span>
            </a>
            <slot name="right" />
        </template>
    </STNavigationBar>
</template>

<script lang="ts" setup>
import OrganizationLogo from '@stamhoofd/components/context/OrganizationLogo.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { LoginProviderType } from '@stamhoofd/structures';
import { computed } from 'vue';

import { useWebshopManager } from '../../composables/useWebshopManager';

withDefaults(defineProps<{
    disablePop?: boolean;
}>(), {
    disablePop: false,
});

const context = useContext();
const webshopManager = useWebshopManager();
const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const userName = computed(() => context.value.user?.firstName ?? '');

function switchAccount() {
    // Do a silent logout
    context.value.removeFromStorage();

    // Redirect to login
    context.value.startSSO({
        webshopId: webshop.value.id,
        prompt: 'select_account',
        providerType: LoginProviderType.SSO,
    }).catch(console.error);
}
</script>
