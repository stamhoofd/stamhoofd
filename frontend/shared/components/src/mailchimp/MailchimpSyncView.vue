<template>
    <SaveView :title="title" :loading="saving" :disabled="needsConsent && !confirmedConsent" :save-text="$t('Synchroniseren')" save-icon="sync" data-testid="mailchimp-sync-view" @save="start">
        <h1>{{ title }}</h1>
        <p v-if="request.full">
            {{ $t('Dit stuurt de huidige toestand van alle leden die in het huidige werkjaar ingeschreven zijn naar Mailchimp.') }}
        </p>
        <p v-else-if="request.type === MailchimpSyncType.Orders">
            {{ $t('De bestellers van de geselecteerde bestellingen worden toegevoegd aan Mailchimp of bijgewerkt. Geannuleerde bestellingen worden overgeslagen.') }}
        </p>
        <p v-else>
            {{ $t('De geselecteerde leden en hun ouders worden toegevoegd aan Mailchimp of bijgewerkt. Een selectie ruimt niets op: gebruik daarvoor de volledige synchronisatie in de instellingen.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="!preview && !errors.errorBox" class="style-description">
            <Spinner />
        </p>

        <STCard v-if="preview" data-testid="mailchimp-sync-preview">
            <STList>
            <STListItem>
                <template #left>
                    <span class="icon email" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('{count} e-mailadressen gaan naar Mailchimp', { count: preview.contacts.toString() }) }}
                </h3>
            </STListItem>
            <STListItem v-if="preview.withoutConsent">
                <template #left>
                    <span class="icon warning gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('{count} zonder nieuwsbrief-toestemming', { count: preview.withoutConsent.toString() }) }}
                </h3>
                <p class="style-description-small">
                    {{ request.full ? $t('Ze worden niet toegevoegd, en uitgeschreven als ze al in Mailchimp staan.') : $t('Ze worden overgeslagen.') }}
                </p>
            </STListItem>
            <STListItem v-if="preview.unsubscribed">
                <template #left>
                    <span class="icon warning gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('{count} uitgeschreven voor e-mails', { count: preview.unsubscribed.toString() }) }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Ze worden niet toegevoegd, en uitgeschreven als ze al in Mailchimp staan.') }}
                </p>
            </STListItem>
            <STListItem v-if="preview.blocked">
                <template #left>
                    <span class="icon warning gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('{count} worden overgeslagen', { count: preview.blocked.toString() }) }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Ongeldig of geblokkeerd e-mailadres') }}
                </p>
            </STListItem>
            </STList>
        </STCard>

        <p v-if="request.full" class="info-box">
            {{ $t('Contacten in Mailchimp met ledentags van {platform} die niet meer overeenkomen met een ingeschreven lid, krijgen een tag die aangeeft dat ze niet meer ingeschreven zijn. Hoeveel dat er zijn, zie je na afloop.', { platform: platform.config.name }) }}
        </p>

        <hr><h2>{{ $t('Opties') }}</h2>
        <STList>
            <STListItem v-if="needsConsent" :selectable="true" element-name="label" data-testid="mailchimp-confirm-consent">
                <template #left>
                    <Checkbox v-model="confirmedConsent" />
                </template>
                <h3 class="style-title-list">
                    {{ request.type === MailchimpSyncType.Orders ? $t('Ik bevestig dat deze bestellers toestemming gaven om mijn nieuwsbrief te ontvangen') : $t('Ik bevestig dat ik toestemming heb om deze personen te mailen') }}
                </h3>
                <p class="style-description-small">
                    {{ request.type === MailchimpSyncType.Orders
                        ? $t('Wie iets bestelt, heeft daarmee nog niet ingestemd met een nieuwsbrief. Bestaande contacten die zich in Mailchimp uitschreven, blijven uitgeschreven.')
                        : $t('Bestaande contacten die zich in Mailchimp uitschreven, blijven uitgeschreven.') }}
                </p>
            </STListItem>

            <STListItem v-if="request.full" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="archiveRemoved" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Ook archiveren in Mailchimp') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Contacten die niet meer overeenkomen worden gearchiveerd. In Mailchimp kan je dat ongedaan maken.') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="doubleOptIn" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Bevestigingsmail door Mailchimp') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Nieuwe contacten moeten eerst bevestigen (double opt-in).') }}
                </p>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { MailchimpSync } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncPreview } from '@stamhoofd/structures/mailchimp/MailchimpSyncPreview.js';
import type { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { MailchimpSyncType } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { computed, onMounted, ref } from 'vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import Checkbox from '#inputs/Checkbox.vue';
import STCard from '#layout/STCard.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import Spinner from '#Spinner.vue';
import { useMailchimpSettings } from './useMailchimp.ts';

const props = withDefaults(defineProps<{
    request: MailchimpSyncRequest;
    onStarted?: ((sync: MailchimpSync) => void) | null;
}>(), {
    onStarted: null,
});

const show = useShow();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const platform = usePlatform();
const { settings } = useMailchimpSettings();

const preview = ref<MailchimpSyncPreview | null>(null);
const saving = ref(false);
const confirmedConsent = ref(false);
const archiveRemoved = ref(false);
const doubleOptIn = ref(false);

const title = computed(() => props.request.full ? $t('Alle leden synchroniseren') : $t('Synchroniseren met Mailchimp'));

// With a newsletter record the consent is recorded per member
const needsConsent = computed(() => props.request.type === MailchimpSyncType.Orders || !settings.value?.newsletterRecordId);

function buildRequest() {
    const request = props.request.clone();
    request.confirmedConsent = confirmedConsent.value;
    request.archiveRemoved = request.full && archiveRemoved.value;
    request.doubleOptIn = doubleOptIn.value;
    return request;
}

onMounted(async () => {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/mailchimp/syncs/preview',
            body: buildRequest(),
            decoder: MailchimpSyncPreview as Decoder<MailchimpSyncPreview>,
            owner,
            shouldRetry: false,
        });
        preview.value = response.data;
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            errors.errorBox = new ErrorBox(e);
        }
    }
});

async function start() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/mailchimp/syncs',
            body: buildRequest(),
            decoder: MailchimpSync as Decoder<MailchimpSync>,
            owner,
            shouldRetry: false,
        });
        props.onStarted?.(response.data);
        await show({
            components: [AsyncComponent(() => import('./MailchimpSyncResultView.vue'), { initialSync: response.data })],
            replace: 1,
            force: true,
        });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}
</script>
