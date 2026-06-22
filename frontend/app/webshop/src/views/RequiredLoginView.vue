<template>
    <LoadingViewTransition>
        <section v-if="!loading" class="st-view box-shade">
            <STNavigationBar :large="true">
                <template #left>
                    <OrganizationLogo :organization="organization" />
                </template>

                <template #right>
                    <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                        <span class="icon external" />
                        <span>{{ $t('%Xf') }}</span>
                    </a>
                </template>
            </STNavigationBar>

            <main>
                <div class="box">
                    <main>
                        <h1>{{ $t('%Qg') }}</h1>
                        <p>
                            {{ $t('%Xi') }}
                        </p>

                        <p v-if="!ssoConfig" class="error-box">
                            {{ $t('%1VK') }}
                        </p>

                        <p>
                            <button type="button" class="button primary" :disabled="!ssoConfig" @click="login">
                                {{ $t('%Qg') }}
                            </button>
                        </p>
                    </main>
                </div>
            </main>
        </section>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import OrganizationLogo from '@stamhoofd/components/context/OrganizationLogo.vue';
import { MetaKey, useMetaInfo } from '@stamhoofd/components/helpers/useMetaInfo.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import { LoginMethod, LoginProviderType } from '@stamhoofd/structures';

import { useLoginMethod } from '@stamhoofd/components/hooks/useLoginMethods.ts';
import { computed, ref, watch } from 'vue';
import { useWebshopManager } from '../composables/useWebshopManager';

const webshopManager = useWebshopManager();
const loading = ref(false);

const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const context = useContext();
const ssoConfig = useLoginMethod(LoginMethod.SSO);

watch(ssoConfig, () => {
    if (!ssoConfig.value) {
        return;
    }

    // Try to log in on first load
    try {
        const search = UrlHelper.initial.getSearchParams();
        // Only try an automatic login once per session.
        if (!sessionStorage.getItem('triedLogin') && !search.get('error') && !search.get('oid_rt')) {
            sessionStorage.setItem('triedLogin', 'true');
            login().catch(console.error);
        }
    } catch (e) {
        console.error(e);
    }
}, { immediate: true });

async function login() {
    // Don't login if sso is not enabled or we're loading.
    if (loading.value || !ssoConfig.value) {
        return;
    }

    await context.value.startSSO({
        webshopId: webshop.value.id,
        providerType: LoginProviderType.SSO,
    });
    loading.value = true;
}

useMetaInfo({
    title: organization.value.name + ' - Inloggen',
    options: {
        key: MetaKey.Routing,
    },
    meta: [
        {
            id: 'description',
            name: 'description',
            content: 'Log in om door te gaan',
        },
        {
            id: 'og:site_name',
            name: 'og:site_name',
            content: organization.value.name,
        },
        {
            // Prevent indexing login page
            id: 'robots',
            name: 'robots',
            content: 'noindex',
        },
    ],
});
</script>
