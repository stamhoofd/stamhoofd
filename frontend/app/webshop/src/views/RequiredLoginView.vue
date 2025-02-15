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
                        <span>Terug naar website</span>
                    </a>
                </template>
            </STNavigationBar>

            <main>
                <div class="box">
                    <main>
                        <h1>Inloggen</h1>
                        <p>
                            Om deze pagina te bekijken moet je eerst inloggen via onderstaande knop.
                        </p>

                        <p>
                            <button type="button" class="button primary" @click="login">
                                Inloggen
                            </button>
                        </p>
                    </main>
                </div>
            </main>
        </section>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { LoadingViewTransition, MetaKey, OrganizationLogo, STNavigationBar, useContext, useMetaInfo } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { LoginProviderType } from '@stamhoofd/structures';

import { computed, onMounted, ref } from 'vue';
import { useWebshopManager } from '../composables/useWebshopManager';

const webshopManager = useWebshopManager();
const loading = ref(false);

const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const context = useContext();

onMounted(() => {
    // Try to log in on first load
    try {
        const search = UrlHelper.initial.getSearchParams();
        if (!sessionStorage.getItem('triedLogin') && !search.get('error') && !search.get('oid_rt')) {
            sessionStorage.setItem('triedLogin', 'true');
            login().catch(console.error);
        }
    }
    catch (e) {
        console.error(e);
    }
});

async function login() {
    if (loading.value) {
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
