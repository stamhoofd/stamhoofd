<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Mailchimp')" />

        <main class="center">
            <h1>{{ $t('Mailchimp') }}</h1>
            <p>
                {{ isPlatform ? $t('Stuur de leden van alle verenigingen vanuit {platform} naar een audience in Mailchimp. De synchronisatie loopt enkel van {platform} naar Mailchimp: wijzigingen in Mailchimp komen niet terug.', { platform: platform.config.name }) : $t('Stuur je leden en bestellers vanuit {platform} naar Mailchimp. De synchronisatie loopt enkel van {platform} naar Mailchimp: wijzigingen in Mailchimp komen niet terug.', { platform: platform.config.name }) }}
                <a :href="$domains.getDocs('mailchimp')" class="inline-link" target="_blank" rel="noopener">{{ $t('Lees de handleiding') }}</a>
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <hr><h2>{{ $t('Koppeling') }}</h2>
            <STCardGroup>
                <STCard :selectable="true" :title="$t('API-sleutel')" :description="settings ? $t(`Verbonden als '{account}' ({dataCenter})`, { account: settings.accountName, dataCenter: settings.dataCenter }) : $t('Nog niet gekoppeld')" data-testid="mailchimp-api-key" @click="openApiKey">
                    <template #left>
                        <IconContainer icon="key" :class="settings ? 'success' : 'gray'">
                            <template #aside>
                                <ProgressIcon :icon="settings ? 'success' : undefined" :progress="settings ? 1 : 0" />
                            </template>
                        </IconContainer>
                    </template>
                    <template #right>
                        <span class="button text">{{ settings ? $t('Wijzigen') : $t('Koppelen') }}</span>
                    </template>
                </STCard>

                <STCard :selectable="!!settings" :disabled="!settings" :title="$t('Audience')" :description="settings?.audienceName ?? $t('Kies de audience waarin je contacten terechtkomen')" data-testid="mailchimp-audience" @click="settings ? openAudience() : undefined">
                    <template #left>
                        <IconContainer icon="group" :class="settings?.audienceId ? 'success' : 'gray'">
                            <template #aside>
                                <ProgressIcon :icon="settings?.audienceId ? 'success' : undefined" :progress="settings?.audienceId ? 1 : 0" />
                            </template>
                        </IconContainer>
                    </template>
                    <template v-if="settings" #right>
                        <span class="button text">{{ settings.audienceId ? $t('Wijzigen') : $t('Kiezen') }}</span>
                    </template>
                </STCard>
            </STCardGroup>

            <template v-if="settings?.audienceId && membersPackage">
                <hr><h2>{{ $t('Leden') }}</h2>
                <p>
                    {{ $t('Alle leden die in het huidige werkjaar ingeschreven zijn, en hun ouders, komen in Mailchimp met een tag per groep.') }}
                    <a :href="$domains.getDocs('mailchimp-leden')" class="inline-link" target="_blank" rel="noopener">{{ $t('Meer info') }}</a>
                </p>

                <STCardGroup>
                    <STCard :selectable="true" :title="$t('Nieuwsbriefvraag')" :description="newsletterDescription" data-testid="mailchimp-newsletter-record" @click="openNewsletterRecord">
                        <template #left>
                            <IconContainer icon="privacy" :class="settings.newsletterRecordId ? 'success' : 'gray'" />
                        </template>
                        <template #right>
                            <span class="button text">{{ settings.newsletterRecordId ? $t('Wijzigen') : $t('Kiezen') }}</span>
                        </template>
                    </STCard>

                    <STCard v-if="newsletterRecord && newsletterRecord.type !== RecordType.Checkbox" :selectable="true" :title="$t(`Antwoorden die 'ja' betekenen`)" :description="newsletterChoiceNames.length ? newsletterChoiceNames.join(', ') : $t('Nog niet gekozen')" data-testid="mailchimp-newsletter-choices" @click="openNewsletterChoices">
                        <template #left>
                            <IconContainer icon="success" :class="newsletterChoiceNames.length ? 'success' : 'gray'" />
                        </template>
                        <template #right>
                            <span class="button text">{{ $t('Wijzigen') }}</span>
                        </template>
                    </STCard>

                    <STCard :selectable="true" :title="$t('Extra tags uit vragen')" :description="tagRecordNames.length ? tagRecordNames.join(', ') : $t('Geen: kies vragen waarvan het antwoord een tag wordt in Mailchimp')" data-testid="mailchimp-tag-records" @click="openTagRecords">
                        <template #left>
                            <IconContainer icon="label" :class="tagRecordNames.length ? 'success' : 'gray'" />
                        </template>
                        <template #right>
                            <span class="button text">{{ $t('Kiezen') }}</span>
                        </template>
                    </STCard>
                </STCardGroup>

                <STCard :title="$t('Alle leden synchroniseren')" :description="$t('Stuur de huidige toestand van alle ingeschreven leden naar Mailchimp. Een selectie synchroniseer je vanuit de ledenlijst.')">
                    <template #left>
                        <IconContainer icon="sync" class="primary" />
                    </template>
                    <template #right>
                        <button class="button primary" type="button" data-testid="mailchimp-sync-all-members" @click="syncAllMembers">
                            <span class="icon sync" />
                            <span>{{ $t('Synchroniseren') }}</span>
                        </button>
                    </template>
                </STCard>
            </template>

            <template v-if="settings?.audienceId && !isPlatform">
                <hr><h2>{{ $t('Bestellers') }}</h2>
                <STCard :title="$t('Bestellers van een webshop')">
                    <template #left>
                        <IconContainer icon="basket" class="gray" />
                    </template>
                    <template #description>
                        {{ $t('Open de bestellingen van een webshop en kies daar de actie Synchroniseren met Mailchimp. Bestellers krijgen een tag per webshop.') }}
                        <a :href="$domains.getDocs('mailchimp-webshops')" class="inline-link" target="_blank" rel="noopener">{{ $t('Meer info') }}</a>
                    </template>
                </STCard>
            </template>

            <template v-if="syncs.length">
                <hr><h2>{{ $t('Laatste synchronisaties') }}</h2>
                <STList>
                    <STListItem v-for="sync of syncs" :key="sync.id" :selectable="true" @click="openSync(sync)">
                        <template #left>
                            <span v-if="sync.isRunning" class="icon sync" />
                            <span v-else-if="sync.status === MailchimpSyncStatus.Failed" class="icon error red" />
                            <span v-else-if="sync.result.failed > 0" class="icon warning yellow" />
                            <span v-else class="icon success green" />
                        </template>
                        <h3 class="style-title-list">
                            {{ getSyncTitle(sync) }}
                        </h3>
                        <p class="style-description-small">
                            {{ formatDateTime(sync.createdAt) }} · {{ getSyncSummary(sync) }}
                        </p>
                        <template #right>
                            <span v-if="sync.isRunning" class="style-tag">{{ $t('Bezig') }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="settings">
                <hr><h2>{{ $t('Koppeling verwijderen') }}</h2>
                <p>{{ $t('Stamhoofd vergeet dan je API-sleutel en instellingen. Contacten die al in Mailchimp staan, blijven daar staan.') }}</p>
                <button class="button secundary danger" type="button" @click="disconnect">
                    <span class="icon trash" />
                    <span>{{ $t('Koppeling verwijderen') }}</span>
                </button>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { RecordType } from '@stamhoofd/structures';
import { MailchimpSync, MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest, MailchimpSyncType } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useMembersPackage } from '#hooks/useMembersPackage.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import IconContainer from '#icons/IconContainer.vue';
import ProgressIcon from '#icons/ProgressIcon.vue';
import STCard from '#layout/STCard.vue';
import STCardGroup from '#layout/STCardGroup.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import { getMailchimpRecordGroups, useMailchimpSettings } from './useMailchimp.ts';

const present = usePresent();
const show = useShow();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const organization = useOrganization();
const platform = usePlatform();
const membersPackage = useMembersPackage();
const { settings, setSettings, isPlatform } = useMailchimpSettings();

const syncs = ref<MailchimpSync[]>([]);
let interval: ReturnType<typeof setInterval> | null = null;

const records = computed(() => getMailchimpRecordGroups(organization.value, platform.value).flatMap(g => g.records));
const newsletterRecord = computed(() => records.value.find(r => r.id === settings.value?.newsletterRecordId) ?? null);
const newsletterChoiceNames = computed(() => (settings.value?.newsletterChoiceIds ?? []).map(id => newsletterRecord.value?.choices.find(c => c.id === id)?.name.toString()).filter(n => !!n));
const tagRecordNames = computed(() => (settings.value?.tagRecordIds ?? []).map(id => records.value.find(r => r.id === id)?.name.toString()).filter(n => !!n));

const newsletterDescription = computed(() => {
    if (newsletterRecord.value) {
        return newsletterRecord.value.name.toString();
    }
    if (settings.value?.newsletterRecordId) {
        return $t('De gekozen vraag bestaat niet meer. Kies een andere vraag.');
    }
    return $t('Geen: alle leden worden toegevoegd na jouw bevestiging bij het synchroniseren');
});

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

function getSyncTitle(sync: MailchimpSync) {
    if (sync.type === MailchimpSyncType.Orders) {
        return $t('Bestellingen');
    }
    return sync.full ? $t('Alle leden') : $t('Selectie van leden');
}

function getSyncSummary(sync: MailchimpSync) {
    if (sync.status === MailchimpSyncStatus.Failed) {
        return sync.errorMessage ?? '';
    }
    const r = sync.result;
    const summary = $t('{added} toegevoegd, {updated} bijgewerkt, {skipped} overgeslagen', {
        added: r.added.toString(),
        updated: r.updated.toString(),
        skipped: r.skipped.toString(),
    });
    if (r.failed) {
        return summary + ', ' + $t('{failed} mislukt', { failed: r.failed.toString() });
    }
    return summary;
}

async function loadSyncs() {
    if (!settings.value?.audienceId) {
        return;
    }
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/mailchimp/syncs',
            decoder: new ArrayDecoder(MailchimpSync as Decoder<MailchimpSync>),
            owner,
        });
        syncs.value = response.data;
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            console.error(e);
        }
    }
}

function startPolling() {
    stopPolling();
    interval = setInterval(() => {
        if (syncs.value.some(s => s.isRunning)) {
            loadSyncs().catch(console.error);
        }
    }, 2000);
}

function stopPolling() {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
}

onMounted(() => {
    loadSyncs().catch(console.error);
    startPolling();
});

watch(() => settings.value?.audienceId, () => {
    loadSyncs().catch(console.error);
});

onBeforeUnmount(() => {
    stopPolling();
});

async function presentSheet(component: ComponentWithProperties) {
    await present({
        components: [new ComponentWithProperties(NavigationController, { root: component })],
        modalDisplayStyle: 'popup',
    });
}

async function openApiKey() {
    await presentSheet(AsyncComponent(() => import('./MailchimpApiKeyView.vue'), {}));
}

async function openAudience() {
    await presentSheet(AsyncComponent(() => import('./MailchimpAudienceView.vue'), {}));
}

async function openNewsletterRecord() {
    await presentSheet(AsyncComponent(() => import('./MailchimpRecordsView.vue'), { mode: 'newsletter' }));
}

async function openNewsletterChoices() {
    await presentSheet(AsyncComponent(() => import('./MailchimpNewsletterChoicesView.vue'), { record: newsletterRecord.value }));
}

async function openTagRecords() {
    await presentSheet(AsyncComponent(() => import('./MailchimpRecordsView.vue'), { mode: 'tags' }));
}

async function syncAllMembers() {
    await presentSheet(AsyncComponent(() => import('./MailchimpSyncView.vue'), {
        request: MailchimpSyncRequest.create({ type: MailchimpSyncType.Members, full: true }),
        onStarted: (sync: MailchimpSync) => {
            syncs.value = [sync, ...syncs.value];
        },
    }));
}

async function openSync(sync: MailchimpSync) {
    await show({
        components: [AsyncComponent(() => import('./MailchimpSyncResultView.vue'), { initialSync: sync })],
    });
}

async function disconnect() {
    if (!await CenteredMessage.confirm($t('Koppeling met Mailchimp verwijderen?'), $t('Verwijderen'), $t('Contacten die al in Mailchimp staan, blijven daar staan.'))) {
        return;
    }
    errors.errorBox = null;
    try {
        await context.value.authenticatedServer.request({
            method: 'DELETE',
            path: '/mailchimp/connect',
            owner,
            shouldRetry: false,
        });
        setSettings(null);
        syncs.value = [];
        Toast.success($t('De koppeling met Mailchimp is verwijderd')).show();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}
</script>
