<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :loading-view="loadingStripeAccounts" :title="$t(`%O7`)" @save="save">
        <h1>
            {{ $t('%40') }}
        </h1>

        <p>{{ $t('%NY') }} <a class="inline-link" :href="$domains.getDocs('stripe')" target="_blank">{{ $t('%K') }}</a> {{ $t('%GT') }} <a class="inline-link" :href="$domains.getDocs('payconiq')" target="_blank">{{ $t('%1Q') }}</a>  {{ $t('%NZ') }} <a class="inline-link" :href="$domains.getDocs('tag/betaalmethodes')" target="_blank">{{ $t('%19t') }}</a>.</p>

        <STErrorsDefault :error-box="errorBox" />

        <template v-if="isBuckarooActive">
            <hr><h2>
                {{ $t('%Na') }}
            </h2>

            <p v-if="isBuckarooActive" class="success-box">
                {{ $t('%Nb') }} {{ buckarooPaymentMethodsString }}
            </p>
        </template>

        <p v-if="hasDuplicateNames" class="warning-box">
            {{ $t('%Nc') }}
        </p>

        <div v-for="account in stripeAccounts" :key="account.id" class="container">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%e') }} <span class="title-suffix">{{ account.accountId }}</span></div>
                <div>
                    <button type="button" class="button icon edit gray" @click="editStripeAccount(account)" />
                </div>
            </h2>

            <p v-if="account.warning" :class="account.warning.type + '-box'">
                {{ account.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('%19t') }}
                </a>
            </p>

            <STList class="info">
                <STListItem v-if="account.meta.settings.dashboard.display_name">
                    <h3 class="style-definition-label">
                        {{ $t('%Nd') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.settings.dashboard.display_name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.business_profile.name">
                    <h3 class="style-definition-label">
                        {{ $t('%Ne') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ account.meta.business_profile.name }}
                    </p>
                </STListItem>

                <STListItem v-if="account.meta.bank_account_last4">
                    <h3 class="style-definition-label">
                        {{ $t('%1D') }}
                    </h3>
                    <p class="style-definition-text">
                        xxxx {{ account.meta.bank_account_last4 }} ({{ account.meta.bank_account_bank_name }})
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1A') }}
                    </h3>
                    <p v-if="account.meta.charges_enabled && account.meta.payouts_enabled && !account.warning" class="style-definition-text with-icons">
                        <span>{{ $t('%Nf') }}</span>
                        <span class="icon success primary small" />
                    </p>
                    <p v-else-if="account.meta.charges_enabled && account.meta.payouts_enabled && account.warning" class="style-definition-text with-icons">
                        <span>{{ $t('%Ng') }}</span>
                        <span class="icon clock gray small" />
                    </p>
                    <p v-else-if="account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text with-icons">
                        <span>{{ $t('%Nh') }}</span>
                        <span class="icon clock gray small" />
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled && !account.meta.details_submitted" class="style-definition-text with-icons">
                        <span>{{ $t('%Ni') }}</span>
                        <span class="icon red canceled small" />
                    </p>
                    <p v-else-if="!account.meta.charges_enabled && !account.meta.payouts_enabled" class="style-definition-text with-icons">
                        <span>{{ $t('%Nj') }}</span>
                        <span class="icon red canceled small" />
                    </p>
                </STListItem>
            </STList>

            <div class="style-button-bar">
                <button v-if="!account.meta.charges_enabled || !account.meta.payouts_enabled || account.warning" type="button" class="button primary" :disabled="creatingStripeAccount" @click="openStripeAccountLink(account.id)">
                    <span>{{ $t('%Nk') }}</span>
                    <span class="icon arrow-right" />
                </button>

                <button v-else type="button" class="button text" :disabled="creatingStripeAccount" @click="loginStripeAccount(account.id)">
                    <span class="icon external" />
                    <span>{{ $t('%1M') }}</span>
                </button>

                <button v-if="account.canDelete || isStamhoofd" class="button text red" type="button" @click="deleteStripeAccount(account.id)">
                    <span class="icon trash" />
                    <span>{{ $t('%Kk') }}</span>
                </button>
            </div>
        </div>

        <template v-if="stripeAccounts.length && canCreateMultipleStripeAccounts">
            <hr><div class="style-button-bar">
                <LoadingButton v-if="stripeAccounts.length === 0 || creatingStripeAccount || canCreateMultipleStripeAccounts" :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span class="icon add" />
                        <span>{{ $t('%a') }}*</span>
                    </button>
                </LoadingButton>
                <a class="button text" :href="$domains.getDocs('stripe')" target="_blank">
                    <span class="icon book" />
                    <span>{{ $t('%Nl') }}</span>
                </a>
            </div>

            <p class="style-description-small for-input">
                * {{ $t('%C1') }}
            </p>
        </template>
        <template v-if="stripeAccounts.length === 0 || creatingStripeAccount">
            <hr><h2>
                {{ $t('%Nm') }}
            </h2>
            <p class="info-box">
                {{ $t('%Nn') }}
            </p>

            <div class="style-button-bar">
                <a class="button primary" :href="$domains.getDocs('stripe')" target="_blank">
                    <span>{{ $t('%No') }}</span>
                    <span class="icon arrow-right" />
                </a>

                <LoadingButton :loading="creatingStripeAccount">
                    <button type="button" class="button secundary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span>{{ $t('%Np') }}</span>
                    </button>
                </LoadingButton>
            </div>
        </template>

        <template v-if="payconiqApiKey || forcePayconiq">
            <hr>
            <h2>{{ $t('%Nq') }}</h2>
            <p>
                {{ $t('%Nr') }} <a :href="$domains.getDocs('payconiq')" target="_blank" class="inline-link">{{ $t('%19t') }}</a>
            </p>

            <STInputBox error-fields="payconiqApiKey" :error-box="errorBox" class="max" :title="$t(`%K9`)">
                <input v-model="payconiqApiKey" class="input" type="text" :placeholder="$t(`%O8`)">
            </STInputBox>
            <p v-if="payconiqAccount && payconiqAccount.name" class="style-description-small">
                {{ $t('%Ns') }} {{ payconiqAccount.name }}, {{ payconiqAccount.iban }}
            </p>
        </template>

        <template v-if="!enableBuckaroo && (organization.privateMeta?.mollieOnboarding || forceMollie)">
            <hr>
            <h2>
                {{ $t('%Nt') }}
            </h2>

            <template v-if="!organization.privateMeta?.mollieOnboarding">
                <p>
                    {{ $t('%2r') }}
                </p>
                <p v-if="isBelgium" class="info-box">
                    {{ $t('%Nu') }}
                </p>

                <p>
                    <button class="button text" type="button" @click="linkMollie">
                        <span class="icon link" />
                        <span>{{ $t('%Nv') }}</span>
                    </button>
                </p>
            </template>
            <template v-else>
                <p v-if="organization.privateMeta.mollieOnboarding.canReceivePayments" class="success-box">
                    {{ $t('%2q') }}
                </p>
                <p v-else class="warning-box">
                    {{ $t('%Nw') }}
                </p>
                <p v-if="!organization.privateMeta.mollieOnboarding.canReceiveSettlements" class="warning-box">
                    {{ $t('%Nx') }}
                </p>

                <p v-if="organization.privateMeta.mollieOnboarding.status === 'NeedsData'" class="style-description-block">
                    {{ $t('%Ny') }}
                </p>
                <p v-if="organization.privateMeta.mollieOnboarding.status === 'InReview'" class="style-description-block">
                    {{ $t('%Nz') }}
                </p>

                <p class="style-button-bar">
                    <LoadingButton :loading="loadingMollie">
                        <button class="button text" type="button" @click="mollieDashboard">
                            <span class="icon external" />
                            <span>{{ $t('%O0') }}</span>
                        </button>
                    </LoadingButton>
                </p>
                <p class="style-button-bar">
                    <button class="button text" type="button" @click="disconnectMollie">
                        <span class="icon trash" />
                        <span>{{ $t('%5U') }}</span>
                    </button>
                </p>

                <STInputBox v-if="mollieProfiles.length > 1" error-fields="mollieProfile" :error-box="errorBox" class="max" :title="$t(`%O9`)">
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
                                <span class="icon success green" :v-tooltip="$t('%O1')" />
                            </template>
                            <template v-else-if="profile.status === 'unverified'" #right>
                                <span class="icon clock gray" :v-tooltip="$t('%O2')" />
                            </template>
                            <template v-else #right>
                                <span class="icon canceled red" :v-tooltip="$t('%O3')" />
                            </template>
                        </STListItem>
                    </STList>
                </STInputBox>
            </template>
        </template>

        <template v-if="isStamhoofd">
            <hr><h2>
                {{ $t('%NU') }}
            </h2>

            <Checkbox v-model="useTestPayments">
                {{ $t('%NV') }}
            </Checkbox>

            <Checkbox v-model="enableBuckaroo">
                {{ $t('%O4') }}
            </Checkbox>

            <div v-if="enableBuckaroo" class="split-inputs">
                <div>
                    <STInputBox error-fields="buckarooSettings.key" :error-box="errorBox" class="max" :title="$t(`%2G`)">
                        <input v-model="buckarooKey" class="input" type="text" :placeholder="$t(`%2G`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('%O5') }}
                    </p>
                </div>
                <div>
                    <STInputBox error-fields="buckarooSettings.secret" :error-box="errorBox" class="max" :title="$t(`%Y`)">
                        <input v-model="buckarooSecret" class="input" type="text" :placeholder="$t(`%Y`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('%O6') }}
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
import { CenteredMessage, CenteredMessageButton } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import IBANInput from '@stamhoofd/components/inputs/IBANInput.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import TooltipDirective from '@stamhoofd/components/directives/Tooltip.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
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
                    human: 'Er ging iets mis bij het koppelen. Een onbekende pagina probeerde Mollie te koppelen. Contacteer ons via ' + this.$t('%2a') + ' als je Mollie probeert te koppelen en het blijft mislukken.',
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
