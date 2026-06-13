<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%Ot`)" @save="save">
        <h1>
            {{ $t('%Ot') }}
        </h1>

        <p>
            {{ $t('%P5') }}
        </p>

        <Checkbox v-model="freeContribution">
            <h3 class="style-title-list">
                {{ $t('%P6') }}
            </h3>
            <p v-if="enableFinancialSupport" class="style-description-small">
                {{ $t('%P7') }}
            </p>
        </Checkbox>

        <div v-if="freeContribution" class="free-contribution-box">
            <STInputBox class="max" :title="$t(`%6o`)">
                <textarea v-model="freeContributionDescription" class="input" :placeholder="$t(`%PB`)" />
            </STInputBox>

            <STInputBox v-for="n in amountCount" :key="n" :title="$t(`%P9`) + ' '+n">
                <PriceInput :model-value="getFreeContributionAmounts(n - 1)" :placeholder="$t(`%PC`) + ' '+n" @update:model-value="setFreeContributionAmounts(n - 1, $event)" />

                <template #right>
                    <button class="button icon trash gray" type="button" @click="deleteOption(n - 1)" />
                </template>
            </STInputBox>

            <p v-if="amountCount === 0" class="info-box">
                {{ $t('%P8') }}
            </p>

            <button class="button text" type="button" @click="addOption">
                <span class="icon add" />
                <span>{{ $t('%P9') }}</span>
            </button>

            <p class="style-description-small">
                {{ $t('%PA') }}
            </p>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { FreeContributionSettings, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';
import { computed, ref, shallowRef } from 'vue';

const baseOrganization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const dismiss = useDismiss();
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const saving = ref(false);
const organizationPatch = shallowRef<AutoEncoderPatchType<Organization> & AutoEncoder>(Organization.patch({ id: baseOrganization.value.id }));
const organization = computed(() => baseOrganization.value.patch(organizationPatch.value));
const enableFinancialSupport = computed(() => organization.value.meta.recordsConfiguration.financialSupport !== null);
const freeContribution = computed({
    get: () => organization.value.meta.recordsConfiguration.freeContribution !== null,
    set: (enable: boolean) => {
        if (enable === freeContribution.value) {
            return;
        }
        organizationPatch.value = organizationPatch.value.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: enable ? FreeContributionSettings.create({}) : null,
                }),
            }),
        });
    },
});
const amountCount = computed(() => organization.value.meta.recordsConfiguration.freeContribution?.amounts?.length ?? 0);
const freeContributionDescription = computed({
    get: () => organization.value.meta.recordsConfiguration.freeContribution?.description ?? '',
    set: (description: string) => {
        organizationPatch.value = organizationPatch.value.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.patch({ description }),
                }),
            }),
        });
    },
});
const hasChanges = computed(() => patchContainsChanges(organizationPatch.value, baseOrganization.value, { version: Version }));

function setAmounts(amounts: number[]) {
    organizationPatch.value = organizationPatch.value.patch({
        meta: OrganizationMetaData.patch({
            recordsConfiguration: OrganizationRecordsConfiguration.patch({
                freeContribution: FreeContributionSettings.create({
                    description: freeContributionDescription.value,
                    amounts,
                }),
            }),
        }),
    });
}

function getFreeContributionAmounts(index: number) {
    return organization.value.meta.recordsConfiguration.freeContribution?.amounts[index] ?? 0;
}

function setFreeContributionAmounts(index: number, amount: number) {
    const amounts = (organization.value.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
    amounts[index] = amount;
    setAmounts(amounts);
}

function deleteOption(index: number) {
    const amounts = (organization.value.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
    amounts.splice(index, 1);
    setAmounts(amounts);
}

function addOption() {
    const amounts = (organization.value.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
    amounts.push((amounts.at(-1) ?? 0) + 10_0000);
    setAmounts(amounts);
}

async function save() {
    if (saving.value) {
        return;
    }

    const errors = new SimpleErrors();
    errorBox.value = errors.errors.length > 0 ? new ErrorBox(errors) : null;
    if (errors.errors.length > 0 || !await validator.validate()) {
        return;
    }

    saving.value = true;
    try {
        await organizationManager.value.patch(organizationPatch.value);
        organizationPatch.value = Organization.patch({ id: baseOrganization.value.id });
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await dismiss({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({ shouldNavigateAway });
</script>
