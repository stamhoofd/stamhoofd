<template>
    <div class="st-view" data-testid="mailchimp-sync-result-view">
        <STNavigationBar :title="$t('Synchronisatie')" />

        <main>
            <h1 v-if="sync.isRunning">
                {{ $t('Contacten worden naar Mailchimp gestuurd…') }}
            </h1>
            <h1 v-else-if="sync.status === MailchimpSyncStatus.Failed">
                {{ $t('Synchronisatie mislukt') }}
            </h1>
            <h1 v-else>
                {{ $t('Synchronisatie voltooid') }}
            </h1>

            <template v-if="sync.isRunning">
                <p class="style-description">
                    <Spinner class="inline" />
                    {{ sync.result.total ? $t('{processed} van {total}', { processed: sync.result.processed.toString(), total: sync.result.total.toString() }) : $t('Gegevens worden opgehaald…') }}
                    · {{ $t('Je kan dit venster sluiten, de synchronisatie loopt verder.') }}
                </p>
            </template>

            <p v-if="sync.status === MailchimpSyncStatus.Failed" class="error-box">
                {{ sync.errorMessage }}
            </p>

            <STCardGroup v-if="!sync.isRunning" :columns="true" data-testid="mailchimp-sync-stats">
                <STCard v-for="stat of stats" :key="stat.label" class="center">
                    <p class="style-statistic">
                        {{ stat.value }}
                    </p>
                    <p class="style-description-small">
                        {{ stat.label }}
                    </p>
                </STCard>
            </STCardGroup>

            <template v-if="sync.result.issues.length">
                <hr><h2>{{ $t('Overgeslagen en mislukte adressen') }}</h2>
                <STList>
                    <STListItem v-for="issue of sync.result.issues" :key="issue.email + issue.reason">
                        <h3 class="style-title-list">
                            {{ issue.email }}
                        </h3>
                        <p class="style-description-small">
                            {{ getReason(issue) }}
                        </p>
                    </STListItem>
                </STList>
                <p v-if="sync.result.issues.length < sync.result.skipped + sync.result.failed" class="style-description-small">
                    {{ $t('Enkel de eerste {count} adressen worden getoond.', { count: sync.result.issues.length.toString() }) }}
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { MailchimpSyncIssue } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSync, MailchimpSyncIssueReason, MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useContext } from '#hooks/useContext.ts';
import STCard from '#layout/STCard.vue';
import STCardGroup from '#layout/STCardGroup.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import Spinner from '#Spinner.vue';

const props = defineProps<{
    initialSync: MailchimpSync;
}>();

const context = useContext();
const owner = useRequestOwner();
const sync = ref(props.initialSync);
let interval: ReturnType<typeof setInterval> | null = null;

const stats = computed(() => {
    const r = sync.value.result;
    const list = [
        { label: $t('Toegevoegd'), value: r.added },
        { label: $t('Bijgewerkt'), value: r.updated },
    ];
    if (sync.value.full) {
        list.push({ label: $t('Niet meer ingeschreven'), value: r.removed });
        if (r.archived) {
            list.push({ label: $t('Gearchiveerd'), value: r.archived });
        }
    }
    list.push({ label: $t('Overgeslagen'), value: r.skipped });
    if (r.failed) {
        list.push({ label: $t('Mislukt'), value: r.failed });
    }
    return list;
});

function getReason(issue: MailchimpSyncIssue) {
    switch (issue.reason) {
        case MailchimpSyncIssueReason.InvalidEmail: return $t('Ongeldig e-mailadres');
        case MailchimpSyncIssueReason.Unsubscribed: return $t('Uitgeschreven voor e-mails');
        case MailchimpSyncIssueReason.HardBounce: return $t('Geblokkeerd (hard bounce)');
        case MailchimpSyncIssueReason.MarkedAsSpam: return $t('Geblokkeerd (gemarkeerd als spam)');
        case MailchimpSyncIssueReason.NoConsent: return $t('Geen nieuwsbrief-toestemming');
        case MailchimpSyncIssueReason.ArchivedInMailchimp: return $t('Gearchiveerd in Mailchimp, maak dat eerst ongedaan in Mailchimp');
        case MailchimpSyncIssueReason.Rejected: return $t('Mailchimp weigerde: {reason}', { reason: issue.detail ?? '' });
    }
}

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/mailchimp/syncs/' + encodeURIComponent(sync.value.id),
            decoder: MailchimpSync as Decoder<MailchimpSync>,
            owner,
        });
        sync.value = response.data;
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            console.error(e);
        }
    }
    if (!sync.value.isRunning && interval) {
        clearInterval(interval);
        interval = null;
    }
}

onMounted(() => {
    if (sync.value.isRunning) {
        interval = setInterval(() => {
            reload().catch(console.error);
        }, 1500);
    }
});

onBeforeUnmount(() => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
});
</script>

<style lang="scss" scoped>
@use "@stamhoofd/scss/base/variables.scss" as *;

.style-statistic {
    font-size: 28px;
    line-height: 1.2;
    font-weight: $font-weight-semibold;
    font-variant-numeric: tabular-nums;
}
</style>
