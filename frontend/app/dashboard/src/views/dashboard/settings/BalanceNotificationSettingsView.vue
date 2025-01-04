<template>
    <SaveView :loading="saving" title="Notificaties" :disabled="!hasChanges" @save="save">
        <h1>
            {{ $t('Notificaties voor openstaande bedragen') }}
        </h1>

        <p>Je kan leden automatisch een e-mail sturen als hun openstaand bedrag stijgt. Dit gebeurt altijd in de ochtend, dus leden krijgen maximaal één e-mail per dag. Als het bedrag na een bepaalde periode nog steeds open staat, ontvangen ze ook om die ingestelde periode een herinneringsemail. Je kan de inhoud van de e-mails wijzigen via de instellingen voor e-mailsjablonen.</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="enabled" />
                </template>

                <h3 class="style-title-list">
                    Inschakelen
                </h3>

                <p class="style-description-small">
                    Schakel dit in om leden automatisch te verwittigen als hun openstaand bedrag stijgt.
                </p>
            </STListItem>
        </STList>

        <div v-if="enabled && (patched.privateMeta?.emails ?? []).length" class="container">
            <hr>
            <h2>E-mailadres</h2>
            <p>Kies een e-mailadres vanwaar je de e-mails wilt versturen. Je kan extra e-mailadressen toevoegen via de instellingen van e-mailadressen.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="emailId" :value="null" />
                    </template>

                    <h3 class="style-title-list">
                        Standaard e-mailadres
                    </h3>
                </STListItem>
                <STListItem v-for="email in patched.privateMeta?.emails ?? []" :key="email.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="emailId" :value="email.id" />
                    </template>

                    <h3 class="style-title-list">
                        {{ email.email }}
                    </h3>

                    <p class="style-description-small">
                        {{ email.name }}
                    </p>
                </STListItem>
            </STList>
        </div>

        <div v-if="enabled && (patched.privateMeta?.emails ?? []).length" class="container">
            <hr>
            <h2>Geavanceerd</h2>
            <p>Kies hoeveel dagen er minimaal tussen elke e-mail moet zitten, en hoeveel e-mails je maximaal wilt versturen ter herinnering voor een openstaand bedrag. E-mails die je zelf verstuurt tellen niet mee.</p>

            <STInputBox title="Minimum dagen tussen herinneringmails" error-fields="price" :error-box="errors.errorBox">
                <NumberInput
                    v-model="minimumDaysBetween" placeholder=""
                    suffix="dagen"
                    suffix-singular="dag"
                    :min="1"
                    :stepper="true"
                />
            </STInputBox>

            <STInputBox title="Maximum e-mails" error-fields="price" :error-box="errors.errorBox">
                <NumberInput
                    v-model="maximumReminderEmails" placeholder=""
                    suffix="e-mails"
                    suffix-singular="e-mail"
                    :min="1"
                    :stepper="true"
                />
            </STInputBox>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { NumberInput, CenteredMessage, Checkbox, ErrorBox, SaveView, STErrorsDefault, STList, STListItem, useErrors, usePatch } from '@stamhoofd/components';
import { BalanceNotificationSettings, OrganizationPrivateMetaData } from '@stamhoofd/structures';

import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { computed, ref } from 'vue';
import { useTranslate } from '@stamhoofd/frontend-i18n';

const organizationManager = useOrganizationManager();

const { patch, patched, addPatch, hasChanges } = usePatch(organizationManager.value.organization);
const saving = ref(false);
const errors = useErrors();
const $t = useTranslate();
const owner = useRequestOwner();
const pop = usePop();

const enabled = computed({
    get: () => patched.value.privateMeta?.balanceNotificationSettings?.enabled ?? false,
    set: (value) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                balanceNotificationSettings: BalanceNotificationSettings.patch({
                    enabled: value,
                }),
            }),
        });
    },
});

const emailId = computed({
    get: () => patched.value.privateMeta?.balanceNotificationSettings?.emailId ?? null,
    set: (value) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                balanceNotificationSettings: BalanceNotificationSettings.patch({
                    emailId: value,
                }),
            }),
        });
    },
});

const minimumDaysBetween = computed({
    get: () => patched.value.privateMeta?.balanceNotificationSettings?.minimumDaysBetween ?? 1,
    set: (value) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                balanceNotificationSettings: BalanceNotificationSettings.patch({
                    minimumDaysBetween: value,
                }),
            }),
        });
    },
});

const maximumReminderEmails = computed({
    get: () => patched.value.privateMeta?.balanceNotificationSettings?.maximumReminderEmails ?? 5,
    set: (value) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                balanceNotificationSettings: BalanceNotificationSettings.patch({
                    maximumReminderEmails: value,
                }),
            }),
        });
    },
});

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    if (!await errors.validator.validate()) {
        saving.value = false;
        return;
    }

    try {
        await organizationManager.value.patch(patch.value, {
            shouldRetry: false,
            owner,
        });

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
