<template>
    <LoadingView v-if="loading" />
    <section v-else class="st-view box-shade">
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
</template>

<script lang="ts" setup>
import { LoadingView, OrganizationLogo, STNavigationBar, useContext } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { LoginProviderType } from '@stamhoofd/structures';

import { computed, onMounted, ref } from 'vue';
import { useWebshopManager } from '../composables/useWebshopManager';

// todo: metaInfo

// metaInfo() {
//         return {
//             title: this.organization.name + " - Inloggen",
//             meta: [
//                 {
//                     vmid: 'description',
//                     name: 'description',
//                     content: "Log in om door te gaan",
//                 },
//                 {
//                     hid: 'og:site_name',
//                     name: 'og:site_name',
//                     content: this.organization.name
//                 },
//                 {
//                     // Prevent indexing login page
//                     name: 'robots',
//                     content: 'noindex'
//                 }
//             ]
//         }
//     }

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
</script>
