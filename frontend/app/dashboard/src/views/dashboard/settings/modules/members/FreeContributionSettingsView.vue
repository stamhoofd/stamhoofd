<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`Vrije bijdrage`)" @save="save">
        <h1>
            {{ $t('16ca0372-9c8f-49f0-938d-aee012e59f8c') }}
        </h1>

        <p>
            {{ $t('ac19ae40-6e9d-4979-bd7c-01f0e672bf64') }}
        </p>

        <Checkbox v-model="freeContribution">
            <h3 class="style-title-list">
                {{ $t('89a52cb4-ccba-42f5-bb8c-1b8beba34e35') }}
            </h3>
            <p v-if="enableFinancialSupport" class="style-description-small">
                {{ $t('d50793b8-3b37-4dba-9f29-c3912d95ece1') }}
            </p>
        </Checkbox>

        <div v-if="freeContribution" class="free-contribution-box">
            <STInputBox class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
                <textarea v-model="freeContributionDescription" class="input" :placeholder="$t(`90830df1-98ef-4f05-a0d4-8801e209dcdc`)" />
            </STInputBox>

            <STInputBox v-for="n in amountCount" :key="n" :title="$t(`Voorgesteld bedrag`) + ' '+n">
                <PriceInput :model-value="getFreeContributionAmounts(n - 1)" :placeholder="$t(`ffee883f-b817-44df-ae42-46c76e77f394`) + ' '+n" @update:model-value="setFreeContributionAmounts(n - 1, $event)" />

                <template #right>
                    <button class="button icon trash gray" type="button" @click="deleteOption(n - 1)" />
                </template>
            </STInputBox>

            <p v-if="amountCount === 0" class="info-box">
                {{ $t('81c2a3fa-a9ec-4276-96c2-cbb93b2d2203') }}
            </p>

            <button class="button text" type="button" @click="addOption">
                <span class="icon add" />
                <span>{{ $t('6caf3dff-0895-476f-8bf5-fdce81f1fb56') }}</span>
            </button>

            <p class="style-description-small">
                {{ $t('31bdee85-c1f4-4561-8f45-33e5527fc151') }}
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
