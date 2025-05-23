<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasSomeChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p>{{ $t('d305770f-19df-45bd-8ca1-787c146a54d7') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-inschrijvingen-instellen')" target="_blank">{{ $t('3280290b-f43e-4e95-a7bd-3c13a153888b') }}</a>.</p>

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="review.$reviewCheckboxData" />
            <hr>
        </div>

        <STErrorsDefault :error-box="errorBox" />

        <EditPaymentMethodsBox type="registration" :organization="organization" :config="config" :private-config="privateConfig" :validator="validator" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)" />
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, IBANInput, LoadingButton, Radio, RadioGroup, ReviewCheckbox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, useReview, useSetupStepTranslations, Validator } from '@stamhoofd/components';
import { Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, PaymentConfiguration, PaymentMethod, PrivatePaymentConfiguration, SetupStepType, Version } from '@stamhoofd/structures';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import EditPaymentMethodsBox from '../../../components/EditPaymentMethodsBox.vue';
@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        LoadingButton,
        IBANInput,
        STList,
        STListItem,
        Checkbox,
        EditPaymentMethodsBox,
        ReviewCheckbox,
    },
})
export default class RegistrationPaymentSettingsView extends Mixins(NavigationMixin) {
    @Prop({ required: false, default: false })
    isReview: boolean;

    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    temp_organization = this.$organization;
    loadingMollie = false;
    $t = useTranslate();
    setupTranslations = useSetupStepTranslations();
    title = '';

    review = useReview(SetupStepType.Payment);
    hasReviewChanges = this.review.$hasChanges;

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = Organization.patch({});

    created() {
        this.organizationPatch.id = this.$organization.id;
        this.title = this.isReview ? this.setupTranslations.getReviewTitle(SetupStepType.Payment) : 'Betaalmethodes voor inschrijvingen';
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    get isBelgium() {
        return this.organization.address.country === Country.Belgium;
    }

    get hasTransfers() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.Transfer);
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.organizationPatch = this.organizationPatch.patch(patch);
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>>) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch(patch),
        });
    }

    get config() {
        return this.organization.meta.registrationPaymentConfiguration;
    }

    patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
        this.addMetaPatch({
            registrationPaymentConfiguration: patch,
        });
    }

    get privateConfig() {
        return this.organization.privateMeta?.registrationPaymentConfiguration ?? PrivatePaymentConfiguration.create({});
    }

    patchPrivateConfig(patch: AutoEncoderPatchType<PrivatePaymentConfiguration>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                registrationPaymentConfiguration: patch,
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
            if (this.hasChanges) {
                await this.$organizationManager.patch(this.organizationPatch);
                this.organizationPatch = Organization.patch({ id: this.$organization.id });
            }

            if (this.hasReviewChanges) {
                await this.review.save();
            }

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

    get hasSomeChanges() {
        return this.hasChanges || this.hasReviewChanges;
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }
}
</script>
