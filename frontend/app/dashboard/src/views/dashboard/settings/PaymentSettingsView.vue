<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :loadingView="loadingStripeAccounts" :title="$t(`47ffc673-424e-4be8-aa64-f01ba8581b64`)">
        <h1>
            {{ $t('32cef019-60fa-4cdc-ad0f-0e7cc255a1d6') }}
        </h1>

        <p>{{ $t('b15c9c52-8898-484a-8b7a-84b81d0e42f5') }} <a class="inline-link" :href="$domains.getDocs('stripe')" target="_blank">{{ $t('f3a66bac-fa77-4538-8eff-b4b9af14a16a') }}</a> {{ $t('c8077f4f-684f-4669-8105-af63bde16322') }} <a class="inline-link" :href="$domains.getDocs('payconiq')" target="_blank">{{ $t('3d19d238-f2ed-4540-b1d4-da55505e132f') }}</a>  {{ $t('57309f99-4316-41e1-b2fc-c7b4640d3b87') }} <a class="inline-link" :href="$domains.getDocs('tag/betaalmethodes')" target="_blank">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a>.</p>

        <STErrorsDefault :error-box="errorBox"/>

        <template v-if="isBuckarooActive">
            <hr><h2>
                {{ $t('43857ac6-a3d6-426b-9794-0c0c51a26b20') }}
            </h2>

            <p v-if="isBuckarooActive" class="success-box">
                {{ $t('d0aa2a76-7ffd-46d4-9437-130a42e0f87a') }} {{ buckarooPaymentMethodsString }}
            </p>
        </template>

        <p v-if="hasDuplicateNames" class="warning-box">
            {{ $t('ab8895c4-b806-42ce-8a3d-58d808f4041c') }}
        </p>

        <div v-for="account in stripeAccounts" :key="account.id" class="container">
            <hr><h2 class="style-with-button">
                <div>{{ $t('091d597b-8d28-43a8-84fc-c0e6a5e61093') }} <span class="title-suffix">{{ account.accountId }}</span></div>
                <div>
                    <button type="button" class="button icon edit gray" @click="editStripeAccount(account)"/>
                </div>
            </h2>

            <p v-if="account.warning" :class="account.warning.type + '-box'">
                {{ account.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}
                </a>
            </p>

            <STList class="info">
                <STListItem v-if="account.meta.settings.dashboard.display_name">
                    <h3 class="style-definition-label">
                        {{ $t('0701d54e-dd4c-4499-b9b2-223ebd1d3311') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.settings.dashboard.display_name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.business_profile.name">
                    <h3 class="style-definition-label">
                        {{ $t('0cdb9cb6-4b25-48b3-9617-0c08e02825d3') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.business_profile.name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.bank_account_last4">
                    <h3 class="style-definition-label">
                        {{ $t('93cd44d9-8be6-44ca-a92a-5f73bde01e44') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ $t('0fd8542e-e075-4b89-8ff0-97749fcd7e24') }} {{ account.meta.bank_account_last4 }} ({{ account.meta.bank_account_bank_name }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('38b75e19-10cb-4641-88a8-f4e2e9be7576') }}
                    </h3>
                    <p v-if="account.meta.charges_enabled && account.meta.payouts_enabled && !account.warning" class="style-definition-text">
                        <span>{{ $t('d33c4526-09bf-4d91-8f6f-6d7ebd753324') }}</span>
                        <span class="icon success primary"/>
                    </p>
                    <p v-else-if="account.meta.charges_enabled && account.meta.payouts_enabled && account.warning" class="style-definition-text">
                        <span>{{ $t('f5dd960a-7fe5-4871-99ea-6c0172c68635') }}</span>
                        <span class="icon clock gray"/>
                    </p>
                    <p v-else-if="account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text">
                        <span>{{ $t('f27eb6d3-eae1-4b68-849f-512ceb534154') }}</span>
                        <span class="icon clock gray"/>
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled && !account.meta.details_submitted" class="style-definition-text">
                        <span>{{ $t('edfe0b87-4b2d-4b2d-a2cf-2df5699b52fa') }}</span>
                        <span class="icon red canceled"/>
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text">
                        <span>{{ $t('9495e1ae-e5ab-4308-8470-4d68d3a32b90') }}</span>
                        <span class="icon red canceled"/>
                    </p>
                </STListItem>
            </STList>

            <div class="style-button-bar">
                <button v-if="!account.meta.charges_enabled || !account.meta.payouts_enabled || account.warning" type="button" class="button primary" :disabled="creatingStripeAccount" @click="openStripeAccountLink(account.id)">
                    <span>{{ $t('86a2baec-4268-4b73-b258-f0b68f6a1229') }}</span>
                    <span class="icon arrow-right"/>
                </button>

                <button v-else type="button" class="button text" :disabled="creatingStripeAccount" @click="loginStripeAccount(account.id)">
                    <span class="icon external"/>
                    <span>{{ $t('43dee501-ce99-4889-93f2-6735749ea597') }}</span>
                </button>

                <button v-if="account.canDelete || isStamhoofd" class="button text red" type="button" @click="deleteStripeAccount(account.id)">
                    <span class="icon trash"/>
                    <span>{{ $t('56601c31-fe62-4109-8677-7dc1398554f5') }}</span>
                </button>
            </div>
        </div>

        <template v-if="stripeAccounts.length && canCreateMultipleStripeAccounts">
            <hr><div class="style-button-bar">
                <LoadingButton v-if="stripeAccounts.length === 0 || creatingStripeAccount || canCreateMultipleStripeAccounts" :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span class="icon add"/>
                        <span>{{ $t('1a198920-82d2-4271-8831-c235620af742') }}</span>
                    </button>
                </LoadingButton>
                <a class="button text" :href="$domains.getDocs('stripe')" target="_blank">
                    <span class="icon book"/>
                    <span>{{ $t('d738d5fd-59a6-447a-b30c-1135eb6e8650') }}</span>
                </a>
            </div>

            <p class="style-description-small for-input">
                * {{ $t('5d507258-d6dd-4b3b-a6ef-1b14c6db14bc') }}
            </p>
        </template>
        <template v-if="stripeAccounts.length === 0 || creatingStripeAccount">
            <hr><h2>
                {{ $t('2bebdeec-6768-411f-a8b4-57533bf332e0') }}
            </h2>
            <p class="info-box">
                {{ $t('f74fbd9a-0466-4f76-8778-1297eddfbf91') }}
            </p>

            <div class="style-button-bar">
                <a class="button primary" :href="$domains.getDocs('stripe')" target="_blank">
                    <span>{{ $t('e0c0a330-52bc-4dbc-b37d-4fed52050b3a') }}</span>
                    <span class="icon arrow-right"/>
                </a>

                <LoadingButton :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span>{{ $t('2296e646-57d7-4986-8c91-5ece82f6b8b2') }}</span>
                    </button>
                </LoadingButton>
            </div>
        </template>

        <template v-if="payconiqApiKey || forcePayconiq">
            <hr><h2>{{ $t('669f449b-2420-4bd8-ab7e-e2be746dab2c') }}</h2>
            <p class="st-list-description">
                {{ $t('6d8913b4-02cf-41d0-a943-f8f5e57499ee') }} <a href="https://www.stamhoofd.be/docs/payconiq/" target="_blank" class="inline-link">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a>
            </p>

            <STInputBox error-fields="payconiqApiKey" :error-box="errorBox" class="max" :title="$t(`2cec0671-0d30-437d-843b-85de648d01bc`)">
                <input v-model="payconiqApiKey" class="input" type="text" :placeholder="$t(`7951bbf3-0710-4a5a-a9cd-452bcf0bb01d`)"></STInputBox>
            <p v-if="payconiqAccount && payconiqAccount.name" class="style-description-small">
                {{ $t('343e35ca-220a-42b8-b83e-628c7cfd5d89') }} {{ payconiqAccount.name }}, {{ payconiqAccount.iban }}
            </p>
        </template>

        <template v-if="!enableBuckaroo && (organization.privateMeta.mollieOnboarding || forceMollie)">
            <hr><h2>
                {{ $t('1bde30f7-3216-46df-a583-3788b7f3434f') }}
            </h2>

            <template v-if="!organization.privateMeta.mollieOnboarding">
                <p class="st-list-description">
                    {{ $t('fa1b8694-6a8c-46ea-ab5e-7ed792083bf0') }}
                </p>
                <p v-if="isBelgium" class="info-box">
                    {{ $t('ed3b7c42-d765-43e8-bf4b-faf0518e9407') }}
                </p>

                <p class="st-list-description">
                    <button class="button text" type="button" @click="linkMollie">
                        <span class="icon link"/>
                        <span>{{ $t('a8887b5c-a214-4bb0-8dec-f8904aa79363') }}</span>
                    </button>
                </p>
            </template>
            <template v-else>
                <p v-if="organization.privateMeta.mollieOnboarding.canReceivePayments" class="success-box">
                    {{ $t('ee891dc5-b8e5-4991-951c-28973dd5df05') }}
                </p>
                <p v-else class="warning-box">
                    {{ $t('38d540fb-367c-4f3f-895e-2a128cc6f2fb') }}
                </p>
                <p v-if="!organization.privateMeta.mollieOnboarding.canReceiveSettlements" class="warning-box">
                    {{ $t('af102a64-b35b-479d-91d9-de9bc7a8ea40') }}
                </p>

                <p v-if="organization.privateMeta.mollieOnboarding.status === 'NeedsData'" class="st-list-description">
                    {{ $t('ff7eba9c-c9ee-4ee0-8c0e-05ede51a15e6') }}
                </p>
                <p v-if="organization.privateMeta.mollieOnboarding.status === 'InReview'" class="st-list-description">
                    {{ $t('cd93a6b8-aaa1-45e1-ab02-b181010d5a4f') }}
                </p>

                <p class="st-list-description">
                    <LoadingButton :loading="loadingMollie">
                        <button class="button text" type="button" @click="mollieDashboard">
                            <span class="icon external"/>
                            <span>{{ $t('11ff808d-6d6f-4905-8b86-bf0ad816db4e') }}</span>
                        </button>
                    </LoadingButton>
                </p>
                <p class="st-list-description">
                    <button class="button text" type="button" @click="disconnectMollie">
                        <span class="icon trash"/>
                        <span>{{ $t('eb55e12d-0c0a-491e-bdbc-6e705b9d82a7') }}</span>
                    </button>
                </p>

                <STInputBox v-if="mollieProfiles.length > 1" error-fields="mollieProfile" :error-box="errorBox" class="max" :title="$t(`600d739e-e0ad-4530-9013-70b8ce3e5b1f`)">
                    <STList>
                        <STListItem v-for="profile in mollieProfiles" :key="profile.id" element-name="label" :selectable="true">
                            <template #left>
                                <Radio v-model="selectedMollieProfile" :value="profile.id"/>
                            </template>
                            <h3 class="style-title-list">
                                {{ profile.name }}
                            </h3>
                            <p class="style-description-small">
                                {{ profile.website }}
                            </p>

                            <template v-if="profile.status === 'verified'" #right>
                                <span v-tooltip="'Geverifieerd'" class="icon success green"/>
                            </template>
                            <template v-else-if="profile.status === 'unverified'" #right>
                                <span v-tooltip="'Wacht op verificatie'" class="icon clock gray"/>
                            </template>
                            <template v-else #right>
                                <span v-tooltip="'Geblokkeerd'" class="icon canceled red"/>
                            </template>
                        </STListItem>
                    </STList>
                </STInputBox>
            </template>
        </template>

        <template v-if="isStamhoofd">
            <hr><h2>
                {{ $t('cabf766a-9ac8-4622-9066-47a52270b0b0') }}
            </h2>

            <Checkbox v-model="useTestPayments">
                {{ $t('7edd7721-1b57-48fd-b200-2cbbdbc22ecf') }}
            </Checkbox>

            <Checkbox v-model="enableBuckaroo">
                {{ $t('d14eced3-a7cc-4ba8-8c30-e2756735abff') }}
            </Checkbox>

            <div v-if="enableBuckaroo" class="split-inputs">
                <div>
                    <STInputBox error-fields="buckarooSettings.key" :error-box="errorBox" class="max" :title="$t(`b867ff55-e5b4-4f82-bed5-cc4197b0286f`)">
                        <input v-model="buckarooKey" class="input" type="text" :placeholder="$t(`b867ff55-e5b4-4f82-bed5-cc4197b0286f`)"></STInputBox>
                    <p class="style-description-small">
                        {{ $t('fdd4bf75-4b0b-4b65-9527-b0abd7994ebd') }}
                    </p>
                </div>
                <div>
                    <STInputBox error-fields="buckarooSettings.secret" :error-box="errorBox" class="max" :title="$t(`da8f869b-8d5a-4670-b105-4af26d645d2a`)">
                        <input v-model="buckarooSecret" class="input" type="text" :placeholder="$t(`da8f869b-8d5a-4670-b105-4af26d645d2a`)"></STInputBox>
                    <p class="style-description-small">
                        {{ $t('265cbeab-c578-460e-a742-ed2464921dbf') }}
                    </p>
                </div>
            </div>

            <hr><code v-for="account of stripeAccounts" :key="'code-'+account.id" class="style-code" v-text="formatJson(account.meta.blob)"/>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, Decoder, field, PatchableArray, patchContainsChanges, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, CenteredMessageButton, Checkbox, ErrorBox, IBANInput, LoadingButton, Radio, RadioGroup, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, TooltipDirective, Validator } from '@stamhoofd/components';
import { AppManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { BuckarooSettings, CheckMollieResponse, Country, MollieProfile, Organization, OrganizationPatch, OrganizationPrivateMetaData, PayconiqAccount, PaymentMethod, StripeAccount, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
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
        Spinner,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class PaymentSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    temp_organization = this.$organization;
    loadingMollie = false;
    loadingStripeAccounts = true;
    creatingStripeAccount = false;
    stripeAccounts: StripeAccount[] = [];
    mollieProfiles: MollieProfile[] = [];

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({});

    created() {
        this.organizationPatch.id = this.$organization.id;
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    get selectedMollieProfile() {
        return this.organization.privateMeta?.mollieProfile?.id ?? null;
    }

    set selectedMollieProfile(id: string | null) {
        const profile = this.mollieProfiles.find(p => p.id === id);
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                mollieProfile: profile ?? null,
            }),
        });
    }

    get canCreateMultipleStripeAccounts() {
        // Check if all current stripe accounts are connected
        return this.stripeAccounts.every(a => (a.meta.charges_enabled && a.meta.payouts_enabled) || (a.meta.details_submitted));
    }

    get isBelgium() {
        return this.organization.address.country === Country.Belgium;
    }

    get isStamhoofd() {
        return this.$organizationManager.user.email.endsWith('@stamhoofd.be') || this.$organizationManager.user.email.endsWith('@stamhoofd.nl');
    }

    formatDateUnix(date: number) {
        return Formatter.date(new Date(date * 1000));
    }

    patchBuckarooPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    paymentMethods: patch,
                }),
            }),
        });
    }

    formatJson(blob: any) {
        return JSON.stringify(blob, null, 2);
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get payconiqAccount() {
        return this.organization.privateMeta?.payconiqAccounts[0] ?? null;
    }

    get payconiqApiKey() {
        return this.organization.privateMeta?.payconiqApiKey ?? '';
    }

    set payconiqApiKey(payconiqApiKey: string) {
        if (this.payconiqApiKey && payconiqApiKey.length === 0) {
            this.forcePayconiq = true;
        }

        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                payconiqAccounts: (payconiqApiKey.length === 0 ? [] : [PayconiqAccount.create({ apiKey: payconiqApiKey })]) as any,
            }),
        });
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null;
    }

    set enableBuckaroo(enable: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: enable ? BuckarooSettings.create({}) : null,
            }),
        });
    }

    get buckarooKey() {
        return this.organization.privateMeta?.buckarooSettings?.key ?? '';
    }

    set buckarooKey(key: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    key,
                }),
            }),
        });
    }

    get buckarooSecret() {
        return this.organization.privateMeta?.buckarooSettings?.secret ?? '';
    }

    set buckarooSecret(secret: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    secret,
                }),
            }),
        });
    }

    get forceMollie() {
        return this.organization.privateMeta?.featureFlags.includes('forceMollie') ?? false;
    }

    set forceMollie(forceMollie: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== 'forceMollie') ?? [];
        if (forceMollie) {
            featureFlags.push('forceMollie');
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any,
            }),
        });
    }

    get forcePayconiq() {
        return this.getFeatureFlag('forcePayconiq') || this.isBelgium;
    }

    set forcePayconiq(forcePayconiq: boolean) {
        this.setFeatureFlag('forcePayconiq', forcePayconiq);
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false;
    }

    setFeatureFlag(flag: string, value: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== flag) ?? [];
        if (value) {
            featureFlags.push(flag);
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any,
            }),
        });
    }

    get payconiqActive() {
        return (this.$organization.privateMeta?.payconiqApiKey ?? '').length > 0;
    }

    get isBuckarooActive() {
        return this.enableBuckaroo && (this.$organization.privateMeta?.buckarooSettings?.key ?? '').length > 0 && (this.$organization.privateMeta?.buckarooSettings?.secret ?? '').length > 0;
    }

    get buckarooPaymentMethodsString() {
        let methods = this.buckarooPaymentMethods;

        if (this.payconiqActive) {
            // Remove Payconiq if has direct link
            methods = methods.filter(m => m !== PaymentMethod.Payconiq);
        }
        return Formatter.joinLast(methods, ', ', ' en ');
    }

    get buckarooPaymentMethods() {
        return this.organization.privateMeta?.buckarooSettings?.paymentMethods ?? [];
    }

    get buckarooAvailableMethods() {
        return [PaymentMethod.Bancontact, PaymentMethod.CreditCard, PaymentMethod.iDEAL, PaymentMethod.Payconiq];
    }

    get useTestPayments() {
        return this.organization.privateMeta?.useTestPayments ?? STAMHOOFD.environment !== 'production';
    }

    set useTestPayments(useTestPayments: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                // Only save non default value
                useTestPayments: STAMHOOFD.environment !== 'production' === useTestPayments ? null : useTestPayments,
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

    async linkMollie() {
        // Start oauth flow
        const client_id = STAMHOOFD.MOLLIE_CLIENT_ID;
        if (!client_id) {
            new Toast('Mollie wordt momenteel niet ondersteund. Probeer later opnieuw.', 'error red').show();
            return;
        }
        const state = Buffer.from(crypto.getRandomValues(new Uint32Array(16))).toString('base64');
        await Storage.keyValue.setItem('mollie-saved-state', state);

        const scope = 'payments.read payments.write refunds.read refunds.write organizations.read organizations.write onboarding.read onboarding.write profiles.read profiles.write subscriptions.read subscriptions.write mandates.read mandates.write settlements.read orders.read orders.write';
        const url = 'https://www.mollie.com/oauth2/authorize?client_id=' + encodeURIComponent(client_id) + '&state=' + encodeURIComponent(state) + '&scope=' + encodeURIComponent(scope) + '&response_type=code&approval_prompt=force&locale=nl_BE';

        window.location.href = url;
    }

    async disconnectMollie() {
        if (await CenteredMessage.confirm('Ben je zeker dat je Mollie wilt loskoppelen?', 'Ja, loskoppelen', 'Jouw Mollie account blijft behouden en kan je later terug koppelen als je dat wilt.')) {
            try {
                const response = await this.$context.authenticatedServer.request({
                    method: 'POST',
                    path: '/mollie/disconnect',
                    decoder: Organization as Decoder<Organization>,
                    owner: this,
                    shouldRetry: false,
                });

                this.$context.updateOrganization(response.data);
                new Toast('Mollie is losgekoppeld', 'success green').show();
            }
            catch (e) {
                new Toast('Loskoppelen mislukt', 'error red').show();
            }
        }
    }

    async doLinkMollie(code: string, state: string) {
        const toast = new Toast('Koppelen...', 'spinner').setHide(null).show();

        try {
            const savedState = await Storage.keyValue.getItem('mollie-saved-state');
            if (savedState !== state) {
                throw new SimpleError({
                    code: 'state_verification_failed',
                    message: 'State is not the same',
                    human: 'Er ging iets mis bij het koppelen. Een onbekende pagina probeerde Mollie te koppelen. Contacteer ons via ' + this.$t('59b85264-c4c3-4cf6-8923-9b43282b2787') + ' als je Mollie probeert te koppelen en het blijft mislukken.',
                });
            }
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/mollie/connect',
                body: {
                    code,
                },
                decoder: Organization as Decoder<Organization>,
                owner: this,
                shouldRetry: false,
            });

            this.$context.updateOrganization(response.data);
            toast.hide();
            new Toast('Mollie is gekoppeld', 'success green').show();
            await Storage.keyValue.removeItem('mollie-saved-state');
        }
        catch (e) {
            console.error(e);
            toast.hide();
            new Toast('Koppelen mislukt', 'error red').show();
        }

        this.updateMollie().catch(console.error);
    }

    lastAddedStripeAccount: string | null = null;

    mounted() {
        const parts = UrlHelper.shared.getParts();
        const urlParams = UrlHelper.shared.getSearchParams();

        console.log(urlParams);

        if (parts.length === 2 && parts[0] === 'oauth' && parts[1] === 'mollie') {
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                this.doLinkMollie(code, state).catch(console.error);
            }
            else {
                const error = urlParams.get('error') ?? '';
                if (error) {
                    new Toast('Koppelen mislukt', 'error red').show();
                }
                this.updateMollie().catch(console.error);
            }
        }
        else {
            if ((this.organization.privateMeta && this.organization.privateMeta.mollieOnboarding) || this.forceMollie) {
                this.updateMollie().catch(console.error);
            }
        }
        this.lastAddedStripeAccount = urlParams.get('recheck-stripe-account');
        this.doRefresh();
        this.refreshOnReturn();
    }

    doRefresh() {
        this.loadStripeAccounts(this.lastAddedStripeAccount).catch(console.error);
    }

    refreshOnReturn() {
        document.addEventListener('visibilitychange', this.doRefresh);
    }

    async loadStripeAccounts(recheckStripeAccount: string | null) {
        try {
            this.loadingStripeAccounts = true;
            if (recheckStripeAccount) {
                try {
                    await this.$context.authenticatedServer.request({
                        method: 'POST',
                        path: '/stripe/accounts/' + encodeURIComponent(recheckStripeAccount),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner: this,
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
            const response = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: '/stripe/accounts',
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                owner: this,
            });
            this.stripeAccounts = response.data;

            if (!recheckStripeAccount) {
                for (const account of this.stripeAccounts) {
                    try {
                        const response = await this.$context.authenticatedServer.request({
                            method: 'POST',
                            path: '/stripe/accounts/' + encodeURIComponent(account.id),
                            decoder: StripeAccount as Decoder<StripeAccount>,
                            owner: this,
                        });
                        account.deepSet(response.data);
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
        this.loadingStripeAccounts = false;
    }

    get hasDuplicateNames() {
        for (const account of this.stripeAccounts) {
            if (this.stripeAccounts.find(a => a.id !== account.id && a.meta.settings.dashboard.display_name === account.meta.settings.dashboard.display_name)) {
                return true;
            }
        }
        return false;
    }

    editStripeAccount(account: StripeAccount) {
        new CenteredMessage('Stripe Dashboard', 'Je kan alle gegevens wijzigen via je Stripe Dashboard. Bovenaan klik je daar op het gebruikersicoontje > Platforminstellingen om gegevens aan te passen.')
            .addButton(
                new CenteredMessageButton('Openen', {
                    action: async () => {
                        await this.loginStripeAccount(account.id);
                    },
                }),
            )
            .addCloseButton()
            .show();
    }

    async createStripeAccount() {
        if (this.isBelgium && (!await CenteredMessage.confirm('Waarschuwing!', 'Ja, gelezen', 'Selecteer de juiste bedrijfsvorm in Stripe. Heb je geen VZW maar een feitelijke vereniging? Selecteer dan \'Vereniging ZONDER rechtspersoonlijkheid\'. Je kan dit later niet meer wijzigen, en spaart dus veel problemen uit. Lees ook zeker de documentatie.'))) {
            return;
        }

        let tab: Window | null = null;
        try {
            tab = tab ?? (AppManager.shared.isNative ? null : window.open('about:blank'));
            this.creatingStripeAccount = true;
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/stripe/connect',
                decoder: StripeAccount as Decoder<StripeAccount>,
                shouldRetry: false,
                owner: this,
            });
            const account = response.data;
            this.stripeAccounts.push(account);

            // Open connect url
            await this.openStripeAccountLink(account.id, tab);
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            tab?.close();
        }
        this.creatingStripeAccount = false;
    }

    async openStripeAccountLink(accountId: string, initialTab?: Window | null) {
        let tab: Window | null = initialTab ?? null;
        try {
            tab = tab ?? (AppManager.shared.isNative ? null : window.open('about:blank'));

            const helper = new UrlHelper();
            helper.getSearchParams().append('recheck-stripe-account', accountId);

            // Override domain (required for native app)
            helper.setDomain(this.organization.dashboardDomain);
            this.lastAddedStripeAccount = accountId;

            class ResponseBody extends AutoEncoder {
                @field({ decoder: StringDecoder })
                url: string;
            }

            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                body: {
                    accountId: accountId,
                    returnUrl: helper.getFullHref(),
                    refreshUrl: helper.getFullHref(),
                },
                path: '/stripe/account-link',
                decoder: ResponseBody as Decoder<ResponseBody>,
                owner: this,
            });

            if (tab) {
                tab.location = response.data.url;
                tab.focus();
            }
            else {
                window.location.href = response.data.url;
            }
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            tab?.close();
        }
    }

    async deleteStripeAccount(accountId: string) {
        if (!(await CenteredMessage.confirm('Dit account verwijderen?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
            return;
        }

        if (!(await CenteredMessage.confirm('Heel zeker?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
            return;
        }

        try {
            await this.$context.authenticatedServer.request({
                method: 'DELETE',
                path: '/stripe/accounts/' + encodeURIComponent(accountId),
                owner: this,
            });
            this.stripeAccounts = this.stripeAccounts.filter(a => a.id !== accountId);
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
        }
    }

    async loginStripeAccount(accountId: string) {
        let tab: Window | null = null;
        try {
            // Immediately open a new tab (otherwise blocked!)
            tab = (AppManager.shared.isNative ? null : window.open('about:blank'));

            class ResponseBody extends AutoEncoder {
                @field({ decoder: StringDecoder })
                url: string;
            }

            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                body: {
                    accountId: accountId,
                },
                path: '/stripe/login-link',
                decoder: ResponseBody as Decoder<ResponseBody>,
                owner: this,
            });

            if (tab) {
                tab.location = response.data.url;
                tab.focus();
            }
            else {
                window.location.href = response.data.url;
            }
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            tab?.close();
        }
    }

    async updateMollie() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'POST',
                path: '/mollie/check',
                decoder: CheckMollieResponse as Decoder<CheckMollieResponse>,
                shouldRetry: false,
                owner: this,
            });

            this.mollieProfiles = response.data.profiles;
            this.$context.updateOrganization(response.data.organization);
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
        }
    }

    async mollieDashboard() {
        if (this.loadingMollie) {
            return;
        }
        this.loadingMollie = true;

        const tab = (AppManager.shared.isNative ? null : window.open('about:blank'));

        if (!tab && !AppManager.shared.isNative) {
            this.loadingMollie = false;
            new Toast('Kon geen scherm openen', 'error red').show();
            return;
        }

        try {
            const url = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: '/mollie/dashboard',
                shouldRetry: false,
                owner: this,
            });

            if (AppManager.shared.isNative) {
                window.open(url.data as any);
            }
            else {
                tab!.location = url.data as any;
                tab!.focus();
            }
        }
        catch (e) {
            await this.updateMollie();
            tab?.close();
            this.errorBox = new ErrorBox(e);
        }

        this.loadingMollie = false;
    }

    beforeUnmount() {
        Request.cancelAll(this);
        document.removeEventListener('visibilitychange', this.doRefresh);
    }
}
</script>
