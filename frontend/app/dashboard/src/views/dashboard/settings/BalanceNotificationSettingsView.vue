<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`79b0e969-d322-4205-a441-3eff602805b6`)">
        <h1>
            {{ $t('ac0594f0-af79-465b-84d5-568da90af8b6') }}
        </h1>

        <p>{{ $t('ed98b821-ac81-47ab-8149-10cb71119bbb') }}</p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="enabled"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('60d3c312-267a-40e5-abbd-574e5920ee4f') }}
                </h3>

                <p class="style-description-small">
                    {{ $feature('organization-receivable-balances') ? $t('a7585599-1c67-4de7-b552-f5b78c7385db') : $t('d75c09fb-24f4-44a0-9e8b-cb7cf1c96dd8') }}
                </p>
            </STListItem>
        </STList>

        <template v-if="enabled">
            <div v-if="(patched.privateMeta?.emails ?? []).length" class="container">
                <hr><h2>{{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }}</h2>
                <p>{{ $t('f36815bd-5308-4046-8626-e3cadb2906cf') }}</p>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="emailId" :value="null"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('2d92d24a-aa10-46b2-be8a-569378673d0a') }}
                        </h3>
                    </STListItem>
                    <STListItem v-for="email in patched.privateMeta?.emails ?? []" :key="email.id" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="emailId" :value="email.id"/>
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

            <div class="container">
                <hr><h2>{{ $t('2dfdb75f-fd62-45df-bc9f-a34a5570dd32') }}</h2>
                <p>{{ $t('18cbfdea-798d-4efc-aad8-f6897c9efb2c') }}</p>

                <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`1f8c6e35-864d-4a0c-96a1-97a1af6d030d`)">
                    <NumberInput v-model="minimumDaysBetween" placeholder="" suffix="dagen" suffix-singular="dag" :min="1" :stepper="true"/>
                </STInputBox>

                <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`c4142504-7da9-4c3a-a4e0-cd08c28b0f5a`)">
                    <NumberInput v-model="maximumReminderEmails" placeholder="" suffix="e-mails" suffix-singular="e-mail" :min="1" :stepper="true"/>
                </STInputBox>
            </div>

            <div v-if="$feature('organization-receivable-balances')" class="container">
                <hr><h2>{{ $t('6b39d554-a4a7-489c-84b5-3f430457dd50') }}</h2>
                <p>{{ $t('0998a455-9ffc-4222-8432-ef7681908ad7') }}</p>

                <MultipleChoiceInput v-model="selectedResponsibilityIds" :items="responsibilities.map(r => ({value: r.id, name: r.name}))" :nullable="false"/>
            </div>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ErrorBox, MultipleChoiceInput, NumberInput, SaveView, STErrorsDefault, STList, STListItem, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { BalanceNotificationSettings, FilterWrapperMarker, OrganizationPrivateMetaData, unwrapFilter } from '@stamhoofd/structures';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { computed, ref } from 'vue';

const organizationManager = useOrganizationManager();

const { patch, patched, addPatch, hasChanges } = usePatch(organizationManager.value.organization);
const saving = ref(false);
const errors = useErrors();
const $t = useTranslate();
const owner = useRequestOwner();
const pop = usePop();
const platform = usePlatform();
const responsibilities = computed(() => {
    return platform.value.config.responsibilities.filter(r => r.organizationBased);
});
const selectedResponsibilityIds = computed({
    get: () => {
        const f = patched.value.privateMeta?.balanceNotificationSettings?.organizationContactsFilter ?? {};
        const unwrapped = unwrapFilter(f, {
            meta: {
                responsibilityIds: {
                    $in: FilterWrapperMarker,
                },
            },
        });
        if (Array.isArray(unwrapped.markerValue) && unwrapped.markerValue.length && unwrapped.markerValue.every(v => typeof v === 'string')) {
            return unwrapped.markerValue;
        }
        return [];
    },
    set(values: string[]) {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                balanceNotificationSettings: BalanceNotificationSettings.patch({
                    organizationContactsFilter: {
                        meta: {
                            responsibilityIds: {
                                $in: values,
                            },
                        },
                    },
                }),
            }),
        });
    },
});

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
