<template>
    <section class="st-view box-shade choose-webshop-view">
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

        <main class="with-legal">
            <div v-if="webshops.length > 0" class="box">
                <main>
                    <h1>Onze webshops</h1>

                    <STList>
                        <STListItem v-for="webshop of webshops" :key="webshop.id" element-name="a" :selectable="true" :href="'https://'+webshop.getUrl(organization)" class="left-center">
                            <template #left>
                                <img v-if="webshop.meta.hasTickets" src="@stamhoofd/assets/images/illustrations/tickets.svg" class="style-illustration-img">
                                <img v-else src="@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img">
                            </template>
                            <h3 class="style-title-list">
                                {{ webshop.meta.name }}
                            </h3>
                            <p class="style-description-small style-limit-lines">
                                {{ webshop.meta.description }}
                            </p>

                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </main>
            </div>
            <div v-else class="box">
                <main>
                    <h1>Onze webshops</h1>
                    <p class="info-box">
                        We organiseren momenteel helaas geen verkoop. Kom later nog eens terug.
                    </p>
                </main>
            </div>

            <LegalFooter :organization="organization" :webshop="webshops[0]" />
        </main>
    </section>
</template>

<script lang="ts" setup>
import { LegalFooter, MetaKey, OrganizationLogo, STList, STListItem, STNavigationBar, useMetaInfo } from '@stamhoofd/components';
import { Organization, WebshopPreview } from '@stamhoofd/structures';

const props = defineProps<{
    organization: Organization;
    webshops: WebshopPreview[];
}>();

useMetaInfo({
    title: props.organization.name + ' - Webshops',
    options: {
        key: MetaKey.Routing,
    },
    meta: [
        {
            id: 'description',
            name: 'description',
            content: 'Kies een webshop om door te gaan',
        },
        {
            id: 'og:site_name',
            name: 'og:site_name',
            content: props.organization.name,
        },
    ],
});
</script>
