<template>
    <div class="legal-footer" :class="{customPlatform: STAMHOOFD.platformName !== 'stamhoofd'}">
        <hr class="style-hr"><div>
            <aside>
                <div>
                    <button v-if="!$isNative && hasLanguages" type="button" class="button text" @click.prevent="switchLanguage">
                        <span class="icon language" />
                        <span> {{ LanguageHelper.getNativeName(I18nController.shared.language) }}</span>
                        <span class="icon arrow-down-small" />
                    </button>
                </div>
                <div>
                    <span>{{ company.name || organization.name }}{{ company.VATNumber || company.companyNumber ? (", "+(company.VATNumber || company.companyNumber)) : "" }}</span>

                    <a v-if="organization.website" :href="organization.website" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        {{ $t('%G') }}
                    </a>

                    <a v-for="policy in policies" :key="policy.id" :href="policy.calculatedUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        {{ policy.name }}
                    </a>

                    <a v-if="privacyUrl" :href="privacyUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        {{ $t('%Oj') }}
                    </a>

                    <button v-if="isLoggedIn" class="inline-link secundary" type="button" @click="logout">
                        {{ $t('%12N') }}
                    </button>
                </div>
            </aside>
            <div v-if="STAMHOOFD.platformName !== 'stamhoofd'" class="style-wysiwyg gray no-underline-links" v-html="platform.config.shopFooterText.html" />
            <div v-else>
                <a v-if="hasTickets" :href="'https://'+ LocalizedDomains.marketing +'?utm_medium=webshop'">{{ $t('%Y3') }} <Logo /></a>
                <a v-else-if="isWebshop" :href="'https://'+ LocalizedDomains.marketing +'?utm_medium=webshop'">{{ $t('%gB') }} <Logo /></a>
                <a v-else :href="'https://'+ LocalizedDomains.marketing +'/ledenadministratie?utm_medium=ledenportaal'">{{ $t('%XC') }} <Logo /></a>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { Company, Organization, Webshop, WebshopPreview } from '@stamhoofd/structures';
import { LanguageHelper, WebshopTicketType } from '@stamhoofd/structures';

import { useContext } from '#hooks/useContext.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { computed } from 'vue';
import Logo from '../icons/Logo.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { useSwitchLanguage } from '#views/hooks/useSwitchLanguage.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import FlagIcon from '#icons/FlagIcon.vue';

const props = withDefaults(
    defineProps<{
        organization: Organization;
        webshop?: Webshop | WebshopPreview | null;
    }>(),
    {
        webshop: null,
    },
);

const context = useContext();
const platform = usePlatform();

const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const company = computed(() => props.organization.defaultCompanies[0] as Company);

async function logout() {
    if (!(await CenteredMessage.confirm($t(`%10Q`), $t(`%10R`), $t(`%10S`)))) {
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
const { hasLanguages, switchLanguage } = useSwitchLanguage();

</script>
