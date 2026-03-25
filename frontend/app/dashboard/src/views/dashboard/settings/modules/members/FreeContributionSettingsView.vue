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

<script lang="ts">
import type { AutoEncoder, AutoEncoderPatchType} from '@simonbackx/simple-encoding';
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { FreeContributionSettings, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        PriceInput,
    },
})
export default class FreeContributionSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    temp_organization = this.$organization;

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = Organization.patch({});

    created() {
        this.organizationPatch.id = this.$organization.id;
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    get enableFinancialSupport() {
        return this.organization.meta.recordsConfiguration.financialSupport !== null;
    }

    get freeContribution() {
        return this.organization.meta.recordsConfiguration.freeContribution !== null;
    }

    set freeContribution(enable: boolean) {
        if (enable === this.freeContribution) {
            return;
        }

        if (enable) {
            this.organizationPatch = this.organizationPatch.patch({
                meta: OrganizationMetaData.patch({
                    recordsConfiguration: OrganizationRecordsConfiguration.patch({
                        freeContribution: FreeContributionSettings.create({}),
                    }),
                }),
            });
        }
        else {
            this.organizationPatch = this.organizationPatch.patch({
                meta: OrganizationMetaData.patch({
                    recordsConfiguration: OrganizationRecordsConfiguration.patch({
                        freeContribution: null,
                    }),
                }),
            });
        }
    }

    get amountCount() {
        return this.organization.meta.recordsConfiguration.freeContribution?.amounts?.length ?? 0;
    }

    getFreeContributionAmounts(index: number) {
        return this.organization.meta.recordsConfiguration.freeContribution?.amounts[index] ?? 0;
    }

    setFreeContributionAmounts(index: number, amount: number) {
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
        amounts[index] = amount;
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.create({
                        description: this.freeContributionDescription,
                        amounts,
                    }),
                }),
            }),
        });
    }

    deleteOption(index: number) {
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
        amounts.splice(index, 1);
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.create({
                        description: this.freeContributionDescription,
                        amounts,
                    }),
                }),
            }),
        });
    }

    addOption() {
        const last = this.organization.meta.recordsConfiguration.freeContribution?.amounts?.slice(-1)[0] ?? 0;
        const amounts = (this.organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).slice();
        amounts.push(last + 10_0000);
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.create({
                        description: this.freeContributionDescription,
                        amounts,
                    }),
                }),
            }),
        });
    }

    get freeContributionDescription() {
        return this.organization.meta.recordsConfiguration.freeContribution?.description ?? '';
    }

    set freeContributionDescription(description: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    freeContribution: FreeContributionSettings.patch({
                        description,
                    }),
                }),
            }),
        });
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors();

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        if (!valid) {
            return;
        }

        this.saving = true;

        try {
            await this.$organizationManager.patch(this.organizationPatch);
            this.organizationPatch = Organization.patch({ id: this.$organization.id });
            new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
            await this.dismiss({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }
}
</script>
