<template>
    <SaveView :title="$t(`%Zu1`)" :loading="saving" :disabled="selectedChoiceIds.length === 0" data-testid="mailchimp-newsletter-choices-view" @save="save">
        <h1>{{ $t(`%ZwP`) }}</h1>
        <p>{{ $t(`%Zx9`, { question: record.name.toString() }) }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="choice of record.choices" :key="choice.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="selectedChoiceIds.includes(choice.id)" @update:model-value="toggleChoice(choice.id, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ choice.name.toString() }}
                </h3>
                <p v-if="choice.description.toString()" class="style-description-small">
                    {{ choice.description.toString() }}
                </p>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { RecordSettings } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { ref } from 'vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import Checkbox from '#inputs/Checkbox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import { replaceIds, useMailchimpSettings } from './useMailchimp.ts';

const props = defineProps<{
    record: RecordSettings;
}>();

const dismiss = useDismiss();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const { settings, setSettings } = useMailchimpSettings();

const isCurrentRecord = settings.value?.newsletterRecordId === props.record.id;
const selectedChoiceIds = ref<string[]>(isCurrentRecord ? [...(settings.value?.newsletterChoiceIds ?? [])] : []);
const saving = ref(false);

function toggleChoice(id: string, selected: boolean) {
    selectedChoiceIds.value = selected ? [...selectedChoiceIds.value, id] : selectedChoiceIds.value.filter(c => c !== id);
}

async function save() {
    if (saving.value || selectedChoiceIds.value.length === 0) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    const patch = MailchimpSettings.patch({ newsletterRecordId: props.record.id });
    replaceIds(patch.newsletterChoiceIds, isCurrentRecord ? (settings.value?.newsletterChoiceIds ?? []) : [], selectedChoiceIds.value);

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
