<template>
    <div class="legal-footer" :class="{customPlatform: STAMHOOFD.platformName !== 'stamhoofd'}">
        <hr class="style-hr"><div>
            <aside>
                {{ company?.name || organization.name }}{{ company?.VATNumber || company?.companyNumber ? (", "+(company?.VATNumber || company?.companyNumber)) : "" }}
                <template v-if="organization.website">
                    -
                </template>
                <a v-if="organization.website" :href="organization.website" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                    {{ $t('4fc09d07-0580-4bc3-aba3-5432a0169884') }}
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
                    {{ $t('6cde0f7a-669e-459e-9044-8ee584a1b7d8') }}
                </a>

                <template v-if="isLoggedIn">
                    -
                </template>

                <button v-if="isLoggedIn" class="inline-link secundary" type="button" @click="logout">
                    {{ $t('79031faf-6e60-4268-a65f-56336ff98c04') }}
                </button>

                <br></aside>
            <div class="style-wysiwyg gray no-underline-links" v-html="platform.config.shopFooterText.html" v-if="STAMHOOFD.platformName !== 'stamhoofd'">
            </div>
            <div v-else>
                <a v-if="hasTickets" :href="'https://'+$domains.marketing+'?utm_medium=webshop'">{{ $t('3896d38a-8485-4ec5-b468-a1c5187094b8') }} <Logo/></a>
                <a v-else-if="isWebshop" :href="'https://'+$domains.marketing+'?utm_medium=webshop'">{{ $t('51fba985-41c7-405d-ac9f-f970d0ed413a') }} <Logo/></a>
                <a v-else :href="'https://'+$domains.marketing+'/ledenadministratie?utm_medium=ledenportaal'">{{ $t('81cf2ea9-da19-4d32-b270-e595dee2d5b0') }} <Logo/></a>
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
const platform = usePlatform()

const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const company = computed(() => props.organization.meta.companies[0] as Company|undefined);

async function logout() {
    if (!(await CenteredMessage.confirm('Wil je uitloggen?', 'Ja, uitloggen', 'Hiermee zal je worden afgemeld.'))) {
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
