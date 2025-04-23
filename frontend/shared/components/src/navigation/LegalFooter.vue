<template>
    <div class="legal-footer" :class="{customPlatform: STAMHOOFD.platformName !== 'stamhoofd'}">
        <hr class="style-hr"><div>
            <aside>
                {{ company?.name || organization.name }}{{ company?.VATNumber || company?.companyNumber ? (", "+(company?.VATNumber || company?.companyNumber)) : "" }}
                <template v-if="organization.website">
                    -
                </template>
                <a v-if="organization.website" :href="organization.website" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                    {{ $t('f6c4cd8c-97e5-40d0-9331-69d15e100726') }}
                </a>

                <template v-for="policy in policies" :key="policy.id">
                    -
                    <a :href="policy.calculatedUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        {{ policy.name }}
                    </a>
                </template>

                <template v-if="privacyUrl">
                    -
                </template>

                <a v-if="privacyUrl" :href="privacyUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                    {{ $t('9f4f2cef-7466-42e3-bca3-d3bfd9f29aa4') }}
                </a>

                <template v-if="isLoggedIn">
                    -
                </template>

                <button v-if="isLoggedIn" class="inline-link secundary" type="button" @click="logout">
                    {{ $t('ecefb25b-4125-4df3-883b-73ddc301529e') }}
                </button>

                <br>
            </aside>
            <div v-if="STAMHOOFD.platformName !== 'stamhoofd'" class="style-wysiwyg gray no-underline-links" v-html="platform.config.shopFooterText.html" />
            <div v-else>
                <a v-if="hasTickets" :href="'https://'+$domains.marketing+'?utm_medium=webshop'">{{ $t('e5749f83-1a33-4185-a07a-b2beea3b69ca') }} <Logo /></a>
                <a v-else-if="isWebshop" :href="'https://'+$domains.marketing+'?utm_medium=webshop'">{{ $t('e38c80b5-b3be-48dd-8646-2c386477b1e5') }} <Logo /></a>
                <a v-else :href="'https://'+$domains.marketing+'/ledenadministratie?utm_medium=ledenportaal'">{{ $t('6a5df3c9-cb80-4f5d-9b5d-94e180bac851') }} <Logo /></a>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Company, Organization, Webshop, WebshopTicketType } from '@stamhoofd/structures';

import { computed } from 'vue';
import { useContext, usePlatform } from '../hooks';
import Logo from '../icons/Logo.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        organization: Organization;
        webshop?: Webshop | null;
    }>(),
    {
        webshop: null,
    },
);

const context = useContext();
const platform = usePlatform();

const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const company = computed(() => props.organization.meta.companies[0] as Company | undefined);

async function logout() {
    if (!(await CenteredMessage.confirm($t(`Wil je uitloggen?`), $t(`Ja, uitloggen`), $t(`Hiermee zal je worden afgemeld.`)))) {
        return;
    }
    await context.value.logout();
}

const privacyUrl = computed(() => {
    if (props.webshop && props.webshop.meta.policies.length > 0) {
        return null;
    }
    if (props.organization.meta.privacyPolicyUrl) {
        return props.organization.meta.privacyPolicyUrl;
    }
    if (props.organization.meta.privacyPolicyFile) {
        return props.organization.meta.privacyPolicyFile.getPublicPath();
    }
    return null;
});

const policies = computed(() => props.webshop?.meta.policies ?? []);

const hasTickets = computed(() => props.webshop?.meta.ticketType === WebshopTicketType.Tickets);

const isWebshop = computed(() => !!props.webshop);
</script>
