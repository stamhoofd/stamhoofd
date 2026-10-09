<template>
    <SaveView :title="title" :loading="saving" :save-text="saveText" data-testid="mailchimp-records-view" @save="save">
        <h1>{{ title }}</h1>
        <p v-if="mode === 'newsletter'">
            {{ $t('Kies de vraag waarmee leden aangeven dat ze de nieuwsbrief willen ontvangen. Enkel aankruisvakjes en keuzevragen zijn mogelijk.') }}
        </p>
        <p v-else>
            {{ $t('Bij een aankruisvakje krijgt het contact een tag als het aangevinkt is, bij een keuzevraag een tag per gekozen antwoord.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <form class="search-box input-icon-container icon search small gray" @submit.prevent>
            <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t('Zoek een vraag…')">
        </form>

        <STList v-if="mode === 'newsletter' && !searchQuery">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="selectedRecordId" :value="null" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Geen nieuwsbriefvraag') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Alle leden worden toegevoegd na jouw bevestiging bij het synchroniseren') }}
                </p>
            </STListItem>
        </STList>

        <div v-for="group of filteredGroups" :key="group.title" class="container">
            <hr><h2>{{ group.title }}</h2>
            <STList>
                <STListItem v-for="record of group.records" :key="record.id" :selectable="!record.sensitive" :disabled="record.sensitive" element-name="label">
                    <template #left>
                        <Radio v-if="mode === 'newsletter'" v-model="selectedRecordId" :value="record.id" :disabled="record.sensitive" />
                        <Checkbox v-else :model-value="selectedRecordIds.includes(record.id)" :disabled="record.sensitive" @update:model-value="toggleRecord(record.id, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ record.name.toString() }}
                    </h3>
                    <p v-if="record.sensitive" class="style-description-small">
                        {{ $t('Gevoelige vraag, kan niet doorgestuurd worden') }}
                    </p>
                    <template #right>
                        <span class="style-tag">{{ getRecordTypeName(record.type) }}</span>
                    </template>
                </STListItem>
            </STList>
        </div>

        <p v-if="filteredGroups.length === 0" class="info-box">
            {{ searchQuery ? $t('Geen vragen gevonden') : $t('Er zijn nog geen vragen die je hiervoor kan gebruiken. Voeg eerst een vraag toe aan je vragenlijsten.') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { RecordType } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { computed, ref } from 'vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import Checkbox from '#inputs/Checkbox.vue';
import Radio from '#inputs/Radio.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';

import { getMailchimpRecordGroups, getRecordTypeName, replaceIds, useMailchimpSettings } from './useMailchimp.ts';

const props = defineProps<{
    mode: 'newsletter' | 'tags';
}>();

const dismiss = useDismiss();
const show = useShow();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const organization = useOrganization();
const platform = usePlatform();
const { settings, setSettings } = useMailchimpSettings();

const title = computed(() => props.mode === 'newsletter' ? $t('Nieuwsbriefvraag') : $t('Extra tags uit vragen'));
const searchQuery = ref('');
const saving = ref(false);

const groups = computed(() => getMailchimpRecordGroups(organization.value, platform.value));
const existingIds = groups.value.flatMap(g => g.records).filter(r => !r.sensitive).map(r => r.id);

// Records that were removed since they were chosen are dropped on save
const selectedRecordId = ref<string | null>(existingIds.find(id => id === settings.value?.newsletterRecordId) ?? null);
const selectedRecordIds = ref<string[]>((settings.value?.tagRecordIds ?? []).filter(id => existingIds.includes(id)));

const filteredGroups = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    return groups.value
        .map(group => ({
            title: group.title,
            records: group.records
                .filter(r => !query || r.name.toString().toLowerCase().includes(query))
                // Sensitive records last
                .sort((a, b) => Number(a.sensitive) - Number(b.sensitive)),
        }))
        .filter(group => group.records.length > 0);
});

const selectedRecord = computed(() => groups.value.flatMap(g => g.records).find(r => r.id === selectedRecordId.value) ?? null);
const needsChoices = computed(() => props.mode === 'newsletter' && !!selectedRecord.value && selectedRecord.value.type !== RecordType.Checkbox);
const saveText = computed(() => needsChoices.value ? $t('Volgende') : $t('Opslaan'));

function toggleRecord(id: string, selected: boolean) {
    selectedRecordIds.value = selected ? [...selectedRecordIds.value, id] : selectedRecordIds.value.filter(r => r !== id);
}

async function save() {
    if (saving.value) {
        return;
    }

    // A choice record needs to know which answers count as yes before it can be saved
    if (needsChoices.value) {
        await show({
            components: [AsyncComponent(() => import('./MailchimpNewsletterChoicesView.vue'), { record: selectedRecord.value })],
        });
        return;
    }

    saving.value = true;
    errors.errorBox = null;

    const patch = MailchimpSettings.patch({});
    if (props.mode === 'newsletter') {
        patch.newsletterRecordId = selectedRecordId.value;
    }
    else {
        replaceIds(patch.tagRecordIds, settings.value?.tagRecordIds ?? [], selectedRecordIds.value);
    }

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/mailchimp/settings',
            body: patch,
            decoder: MailchimpSettings as Decoder<MailchimpSettings>,
            owner,
            shouldRetry: false,
        });
        setSettings(response.data);
        await dismiss({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}
</script>
