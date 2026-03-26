<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%Ms`)" @save="save">
        <h1>
            {{ $t('%HH') }}
        </h1>

        <p>{{ $t('%8y') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="enabled" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%Mp') }}
                </h3>

                <p class="style-description-small">
                    {{ $feature('organization-receivable-balances') ? $t('%8z') : $t('%90') }}
                </p>
            </STListItem>
        </STList>

        <template v-if="enabled">
            <div v-if="(patched.privateMeta?.emails ?? []).length" class="container">
                <hr><h2>{{ $t('%1FK') }}</h2>
                <p>{{ $t('%Mq') }}</p>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="emailId" :value="null" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%Mr') }}
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

            <div class="container">
                <hr><h2>{{ $t('%HQ') }}</h2>
                <p>{{ $t('%91') }}</p>

                <NumberInputBox v-model="minimumDaysBetween" error-fields="price" :error-box="errors.errorBox" :title="$t(`%Mt`)" placeholder="" :suffix="$t('%1N6')" :suffix-singular="$t('%1N7')" :min="1" :stepper="true" :validator="errors.validator" />

                <NumberInputBox v-model="maximumReminderEmails" error-fields="price" :error-box="errors.errorBox" :title="$t(`%Mu`)" :validator="errors.validator" placeholder="" suffix="e-mails" suffix-singular="e-mail" :min="1" :stepper="true" />
            </div>

            <div v-if="$feature('organization-receivable-balances')" class="container">
                <hr><h2>{{ $t('%92') }}</h2>
                <p>{{ $t('%93') }}</p>

                <MultipleChoiceInput v-model="selectedResponsibilityIds" :items="responsibilities.map(r => ({value: r.id, name: r.name}))" :nullable="false" />
            </div>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import MultipleChoiceInput from '@stamhoofd/components/inputs/MultipleChoiceInput.vue';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { BalanceNotificationSettings, FilterWrapperMarker, OrganizationPrivateMetaData, unwrapFilter } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const organizationManager = useOrganizationManager();

const { patch, patched, addPatch, hasChanges } = usePatch(organizationManager.value.organization);
const saving = ref(false);
const errors = useErrors();

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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
