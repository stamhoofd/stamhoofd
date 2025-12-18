<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :loading-view="loadingStripeAccounts" :title="$t(`12b644c9-c1a7-4930-afb2-79f62648d243`)" @save="save">
        <h1>
            {{ $t('e8600ed0-ac82-4c0f-8719-bd91173d653f') }}
        </h1>

        <p>{{ $t('a31eaafb-e2d1-4e41-8fa1-1c58a9bd585f') }} <a class="inline-link" :href="$domains.getDocs('stripe')" target="_blank">{{ $t('079c3c5d-b816-4adf-9287-6f5352a2cd81') }}</a> {{ $t('411cf334-eebb-4f27-beb6-d81bd544c3f5') }} <a class="inline-link" :href="$domains.getDocs('payconiq')" target="_blank">{{ $t('8f39177b-f214-4f23-82ab-329c66ae731a') }}</a>  {{ $t('e06250b5-6d74-4690-8837-a4455aa9e44d') }} <a class="inline-link" :href="$domains.getDocs('tag/betaalmethodes')" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>.</p>

        <STErrorsDefault :error-box="errorBox" />

        <template v-if="isBuckarooActive">
            <hr><h2>
                {{ $t('c9431f00-2628-4dae-9ed9-97729821c025') }}
            </h2>

            <p v-if="isBuckarooActive" class="success-box">
                {{ $t('faa806d2-f6d7-426f-81c9-f4172dda5c0d') }} {{ buckarooPaymentMethodsString }}
            </p>
        </template>

        <p v-if="hasDuplicateNames" class="warning-box">
            {{ $t('a351a6c6-9694-417f-aa91-985470aa0956') }}
        </p>

        <div v-for="account in stripeAccounts" :key="account.id" class="container">
            <hr><h2 class="style-with-button">
                <div>{{ $t('2be4de1c-159a-4767-b461-3ba0f67877d7') }} <span class="title-suffix">{{ account.accountId }}</span></div>
                <div>
                    <button type="button" class="button icon edit gray" @click="editStripeAccount(account)" />
                </div>
            </h2>

            <p v-if="account.warning" :class="account.warning.type + '-box'">
                {{ account.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}
                </a>
            </p>

            <STList class="info">
                <STListItem v-if="account.meta.settings.dashboard.display_name">
                    <h3 class="style-definition-label">
                        {{ $t('679776ce-4997-43cf-837a-0c7f5a70dcf1') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.settings.dashboard.display_name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.business_profile.name">
                    <h3 class="style-definition-label">
                        {{ $t('88b65545-d735-450d-9441-ede25969f5f9') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.business_profile.name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.bank_account_last4">
                    <h3 class="style-definition-label">
                        {{ $t('6e40269e-10f8-4c19-804f-dac6ba75959b') }}
                    </h3>
                    <p class="style-definition-text">
                        xxxx {{ account.meta.bank_account_last4 }} ({{ account.meta.bank_account_bank_name }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5') }}
                    </h3>
                    <p v-if="account.meta.charges_enabled && account.meta.payouts_enabled && !account.warning" class="style-definition-text">
                        <span>{{ $t('6f442433-dc3a-4500-918a-65e5776307fc') }}</span>
                        <span class="icon success primary" />
                    </p>
                    <p v-else-if="account.meta.charges_enabled && account.meta.payouts_enabled && account.warning" class="style-definition-text">
                        <span>{{ $t('9631f5ce-dbb9-4463-b565-618446657ea2') }}</span>
                        <span class="icon clock gray" />
                    </p>
                    <p v-else-if="account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text">
                        <span>{{ $t('993b4fec-d7a4-4b8f-807a-f0343843e369') }}</span>
                        <span class="icon clock gray" />
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled && !account.meta.details_submitted" class="style-definition-text">
                        <span>{{ $t('21b3891d-7c0e-49ca-ae35-d77d54e9f0c3') }}</span>
                        <span class="icon red canceled" />
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text">
                        <span>{{ $t('7d59ec07-4b73-441c-a679-426796f426e4') }}</span>
                        <span class="icon red canceled" />
                    </p>
                </STListItem>
            </STList>

            <div class="style-button-bar">
                <button v-if="!account.meta.charges_enabled || !account.meta.payouts_enabled || account.warning" type="button" class="button primary" :disabled="creatingStripeAccount" @click="openStripeAccountLink(account.id)">
                    <span>{{ $t('85cf8f92-6092-4546-a43e-f86319e80aa1') }}</span>
                    <span class="icon arrow-right" />
                </button>

                <button v-else type="button" class="button text" :disabled="creatingStripeAccount" @click="loginStripeAccount(account.id)">
                    <span class="icon external" />
                    <span>{{ $t('89d0154d-edcb-4a56-b4d7-1c95c13c4fb1') }}</span>
                </button>

                <button v-if="account.canDelete || isStamhoofd" class="button text red" type="button" @click="deleteStripeAccount(account.id)">
                    <span class="icon trash" />
                    <span>{{ $t('1bb244c4-6ffb-4969-91e6-ea70f16ac5a4') }}</span>
                </button>
            </div>
        </div>

        <template v-if="stripeAccounts.length && canCreateMultipleStripeAccounts">
            <hr><div class="style-button-bar">
                <LoadingButton v-if="stripeAccounts.length === 0 || creatingStripeAccount || canCreateMultipleStripeAccounts" :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span class="icon add" />
                        <span>{{ $t('21610c8e-44fb-4afb-9456-c57b938d4c8e') }}*</span>
                    </button>
                </LoadingButton>
                <a class="button text" :href="$domains.getDocs('stripe')" target="_blank">
                    <span class="icon book" />
                    <span>{{ $t('58d5950b-f52f-436a-bc82-222c80ce7356') }}</span>
                </a>
            </div>

            <p class="style-description-small for-input">
                * {{ $t('5d507258-d6dd-4b3b-a6ef-1b14c6db14bc') }}
            </p>
        </template>
        <template v-if="stripeAccounts.length === 0 || creatingStripeAccount">
            <hr><h2>
                {{ $t('b3485987-0e69-4eeb-ba2d-89fd27fc5d74') }}
            </h2>
            <p class="info-box">
                {{ $t('b3540f2c-6f8c-412b-9c97-89b38606700c') }}
            </p>

            <div class="style-button-bar">
                <a class="button primary" :href="$domains.getDocs('stripe')" target="_blank">
                    <span>{{ $t('5e78695a-76f4-4ad0-9f2d-7f0ac9a0220e') }}</span>
                    <span class="icon arrow-right" />
                </a>

                <LoadingButton :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span>{{ $t('e6461543-af38-49d0-a97b-448826be1148') }}</span>
                    </button>
                </LoadingButton>
            </div>
        </template>

        <template v-if="payconiqApiKey || forcePayconiq">
            <hr>
            <h2>{{ $t('df421a41-36de-4225-b22b-2401a4009f90') }}</h2>
            <p>
                {{ $t('455200de-131e-4508-b5e7-3f94a05fb52b') }} <a :href="$domains.getDocs('payconiq')" target="_blank" class="inline-link">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>
            </p>

            <STInputBox error-fields="payconiqApiKey" :error-box="errorBox" class="max" :title="$t(`da7c1f63-529d-47c6-8d2d-87e5cb98a411`)">
                <input v-model="payconiqApiKey" class="input" type="text" :placeholder="$t(`70cb0ddd-7379-4359-a6cb-a581382a38ce`)">
            </STInputBox>
            <p v-if="payconiqAccount && payconiqAccount.name" class="style-description-small">
                {{ $t('f957f196-7656-4e0a-9b33-7b18ced4f493') }} {{ payconiqAccount.name }}, {{ payconiqAccount.iban }}
            </p>
        </template>

        <template v-if="!enableBuckaroo && (organization.privateMeta?.mollieOnboarding || forceMollie)">
            <hr>
            <h2>
                {{ $t('8392834f-9cfb-4af0-8a8d-55c727cbfd66') }}
            </h2>

            <template v-if="!organization.privateMeta?.mollieOnboarding">
                <p>
                    {{ $t('fa1b8694-6a8c-46ea-ab5e-7ed792083bf0') }}
                </p>
                <p v-if="isBelgium" class="info-box">
                    {{ $t('ab21ae18-0181-44ea-b41d-ff61c9358858') }}
                </p>

                <p>
                    <button class="button text" type="button" @click="linkMollie">
                        <span class="icon link" />
                        <span>{{ $t('b0d861f2-1bad-4feb-aec7-116a9a954260') }}</span>
                    </button>
                </p>
            </template>
            <template v-else>
                <p v-if="organization.privateMeta.mollieOnboarding.canReceivePayments" class="success-box">
                    {{ $t('ee891dc5-b8e5-4991-951c-28973dd5df05') }}
                </p>
                <p v-else class="warning-box">
                    {{ $t('060bd617-bccb-48c3-b140-06440eaf6186') }}
                </p>
                <p v-if="!organization.privateMeta.mollieOnboarding.canReceiveSettlements" class="warning-box">
                    {{ $t('2951c3d6-8a53-4678-b041-dff464dd44e9') }}
                </p>

                <p v-if="organization.privateMeta.mollieOnboarding.status === 'NeedsData'" class="style-description-block">
                    {{ $t('f4bd8e62-6828-4ae7-b2b8-4d3dbdf01d57') }}
                </p>
                <p v-if="organization.privateMeta.mollieOnboarding.status === 'InReview'" class="style-description-block">
                    {{ $t('0e46dfc8-f362-4d1d-a3d1-1e28ba5f41c9') }}
                </p>

                <p class="style-button-bar">
                    <LoadingButton :loading="loadingMollie">
                        <button class="button text" type="button" @click="mollieDashboard">
                            <span class="icon external" />
                            <span>{{ $t('6ab27b71-4ea3-4359-b2b6-43e27e8ab528') }}</span>
                        </button>
                    </LoadingButton>
                </p>
                <p class="style-button-bar">
                    <button class="button text" type="button" @click="disconnectMollie">
                        <span class="icon trash" />
                        <span>{{ $t('eb55e12d-0c0a-491e-bdbc-6e705b9d82a7') }}</span>
                    </button>
                </p>

                <STInputBox v-if="mollieProfiles.length > 1" error-fields="mollieProfile" :error-box="errorBox" class="max" :title="$t(`fff3c776-62e8-4957-a79d-0eec462b3f5d`)">
                    <STList>
                        <STListItem v-for="profile in mollieProfiles" :key="profile.id" element-name="label" :selectable="true">
                            <template #left>
                                <Radio v-model="selectedMollieProfile" :value="profile.id" />
                            </template>
                            <h3 class="style-title-list">
                                {{ profile.name }}
                            </h3>
                            <p class="style-description-small">
                                {{ profile.website }}
                            </p>

                            <template v-if="profile.status === 'verified'" #right>
                                <span class="icon success green" :v-tooltip="$t('3686816f-e3c4-4d60-8e87-1f323dba4547')" />
                            </template>
                            <template v-else-if="profile.status === 'unverified'" #right>
                                <span class="icon clock gray" :v-tooltip="$t('4e8d5d7e-7fa6-4053-b526-fbac0dc727b3')" />
                            </template>
                            <template v-else #right>
                                <span class="icon canceled red" :v-tooltip="$t('1abd3897-083d-4625-98f6-7143c54bafbf')" />
                            </template>
                        </STListItem>
                    </STList>
                </STInputBox>
            </template>
        </template>

        <template v-if="isStamhoofd">
            <hr><h2>
                {{ $t('a0044037-18fd-465d-8907-9f7064342279') }}
            </h2>

            <Checkbox v-model="useTestPayments">
                {{ $t('02fe4c35-562f-429c-9250-dbd25ca01357') }}
            </Checkbox>

            <Checkbox v-model="enableBuckaroo">
                {{ $t('e0fe5113-8278-43c3-9cec-7485c057c8b3') }}
            </Checkbox>

            <div v-if="enableBuckaroo" class="split-inputs">
                <div>
                    <STInputBox error-fields="buckarooSettings.key" :error-box="errorBox" class="max" :title="$t(`d54cbd0f-91c6-484a-b071-5161d4060dd7`)">
                        <input v-model="buckarooKey" class="input" type="text" :placeholder="$t(`d54cbd0f-91c6-484a-b071-5161d4060dd7`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('789610a2-6871-4ffb-816f-592ce7711d25') }}
                    </p>
                </div>
                <div>
                    <STInputBox error-fields="buckarooSettings.secret" :error-box="errorBox" class="max" :title="$t(`1c6a928f-1e53-421e-939f-a54959b45769`)">
                        <input v-model="buckarooSecret" class="input" type="text" :placeholder="$t(`1c6a928f-1e53-421e-939f-a54959b45769`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('b688abde-1da5-4c76-93d6-1970219d1ee3') }}
                    </p>
                </div>
            </div>

            <hr><code v-for="account of stripeAccounts" :key="'code-'+account.id" class="style-code" v-text="formatJson(account.meta.blob)" />
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
import { BuckarooSettings, CheckMollieResponse, Country, MollieProfile, Organization, OrganizationPrivateMetaData, PayconiqAccount, PaymentMethod, StripeAccount, Version } from '@stamhoofd/structures';
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

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = Organization.patch({});

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
            this.organizationPatch = Organization.patch({ id: this.$organization.id });
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
        // Make sure we redirect teh fixed /oauth/mollie to the correct organization url
        const realRedirectUrl = new URL(window.location.href);
        realRedirectUrl.pathname = realRedirectUrl.pathname + '/oauth/mollie';
        await Storage.keyValue.setItem('mollie-saved-redirect-url', realRedirectUrl.pathname);

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
            await Storage.keyValue.removeItem('mollie-saved-redirect-url');
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
        const urlParams = UrlHelper.shared.getSearchParams();

        const mollieMatch = this.$url.match('/oauth/mollie');
        if (mollieMatch) {
            const code = mollieMatch.query.get('code');
            const state = mollieMatch.query.get('state');

            if (code && state) {
                this.doLinkMollie(code, state).catch(console.error);
            }
            else {
                const error = mollieMatch.query.get('error') ?? '';
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
