<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Vrije bijdrage`)">
        <h1>
            {{ $t('40157aa3-6407-4429-a14a-fb8773df802b') }}
        </h1>

        <p>
            {{ $t('1af52fff-0b7b-431a-b9a2-72f1703a5db9') }}
        </p>

        <Checkbox v-model="freeContribution">
            <h3 class="style-title-list">
                {{ $t('62e2174b-7555-43f1-9496-c586e00b1bd5') }}
            </h3>
            <p v-if="enableFinancialSupport" class="style-description-small">
                {{ $t('31a3a4bc-3a78-434e-b916-082b9261cc16') }}
            </p>
        </Checkbox>

        <div v-if="freeContribution" class="free-contribution-box">
            <STInputBox class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
                <textarea v-model="freeContributionDescription" class="input" :placeholder="$t(`62c4d8f1-8f16-470a-9aee-ea867c45fe36`)"/>
            </STInputBox>

            <STInputBox v-for="n in amountCount" :key="n" :title="$t(`Voorgesteld bedrag`) + ' '+n">
                <PriceInput :model-value="getFreeContributionAmounts(n - 1)" :placeholder="$t(`0186cc6a-aa89-463a-8cd7-d55d34ab93d3`) + ' '+n" @update:model-value="setFreeContributionAmounts(n - 1, $event)"/>

                <template #right>
                    <button class="button icon trash gray" type="button" @click="deleteOption(n - 1)"/>
                </template>
            </STInputBox>

            <p v-if="amountCount === 0" class="info-box">
                {{ $t('d070e782-121b-4042-bb10-3e650c601733') }}
            </p>

            <button class="button text" type="button" @click="addOption">
                <span class="icon add"/>
                <span>{{ $t('82ecbea3-1611-4b5a-9d53-2d0e2cdc4888') }}</span>
            </button>

            <p class="style-description-small">
                {{ $t('3411188b-2999-491c-854b-90da34b5377a') }}
            </p>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, PriceInput, SaveView, STErrorsDefault, STInputBox, Toast, Validator } from '@stamhoofd/components';
import { FreeContributionSettings, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';

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

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({});

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
        amounts.push(last + 10 * 100);
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
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id });
            new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
            this.dismiss({ force: true });
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

    mounted() {
        this.setUrl('/free-contribution');
    }
}
</script>
