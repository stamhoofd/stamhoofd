<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :loading-view="loadingStripeAccounts" :title="$t(`%O7`)" @save="save">
        <h1>
            {{ $t('%40') }}
        </h1>

        <p>{{ $t('%NY') }} <a class="inline-link" :href="$domains.getDocs('stripe')" target="_blank">{{ $t('%K') }}</a> {{ $t('%GT') }} <a class="inline-link" :href="$domains.getDocs('mollie')" target="_blank">{{ $t('Mollie') }}</a>  {{ $t('%NZ') }} <a class="inline-link" :href="$domains.getDocs('bancontact')" target="_blank">{{ $t('%19t') }}</a>.</p>

        <STErrorsDefault :error-box="errors.errorBox" />

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
                        •••• {{ account.meta.bank_account_last4 }} ({{ account.meta.bank_account_bank_name }})
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

        <div v-if="stripeAccounts.length === 0 || creatingStripeAccount" class="container">
            <hr><aside class="style-title-prefix">
                {{ $t('%Nm') }}
            </aside>

            <h2 v-if="isBelgium">
                Bancontact of kredietkaart via Stripe  <span class="style-tag">Snelst + Meest gebruikt</span>
            </h2>
            <h2 v-else>
                iDEAL en kredietkaart via Stripe <span class="style-tag">Snelst + Meest gebruikt</span>
            </h2>
            <p v-if="isBelgium">
                Via Stripe kan je snel en eenvoudig online betalingen accepteren via Bancontact, kredietkaart, iDEAL en meer. <a :href="$domains.getDocs('stripe')" target="_blank" class="inline-link">Meer info</a>. Als je alles zorgvuldig invult en eerst de documentatie naleest, kan je dit in minder dan een half uur activeren.
            </p>
            <p v-else>
                Via Stripe kan je snel en eenvoudig online betalingen accepteren via iDEAL of kredietkaart. <a :href="$domains.getDocs('stripe')" target="_blank" class="inline-link">Meer info</a>. Als je alles zorgvuldig invult en eerst de documentatie naleest, kan je dit in minder dan een half uur activeren.
            </p>

            <p class="info-box">
                {{ $t('%Nn') }}
            </p>

            <div class="style-button-bar">
                <LoadingButton :loading="creatingStripeAccount">
                    <button type="button" class="button primary" :disabled="creatingStripeAccount" @click="createStripeAccount">
                        <span>{{ $t('%Np') }}</span>
                    </button>
                </LoadingButton>

                <a class="button secundary" :href="$domains.getDocs('stripe')" target="_blank">
                    <span>{{ $t('%No') }}</span>
                    <span class="icon book" />
                </a>
            </div>
        </div>

        <template v-if="!enableBuckaroo">
            <hr>
            <aside class="style-title-prefix">
                {{ $t('Mollie') }}
            </aside>
            <h2 v-if="isBelgium">
                {{ $t('Bancontact of kredietkaart via Mollie ') }}<span class="style-tag">{{ $t('Europees') }}</span> <span class="style-tag discount">{{ $t('Soms goedkoper') }}</span>
            </h2>
            <h2 v-else>
                {{ $t('iDEAL en kredietkaart via Mollie ') }}<span class="style-tag">{{ $t('Europees') }}</span> <span class="style-tag discount">{{ $t('Soms goedkoper') }}</span>
            </h2>

            <template v-if="!organization.privateMeta?.mollieOnboarding">
                <p>
                    {{ $t('%2r') }}
                </p>

                <p class="info-box">
                    {{ $t('Lees eerst onze gids voor je begint! Neem je tijd om alles netjes en volledig in te vullen. Maak je fouten, dan riskeer je dat de aansluiting veel langer duurt.') }}
                </p>

                <div class="style-button-bar">
                    <button type="button" class="button primary" @click="linkMollie">
                        <span>{{ $t('Aansluiten bij Mollie') }}</span>
                    </button>

                    <a class="button secundary" :href="$domains.getDocs('mollie')" target="_blank">
                        <span>{{ $t('%No') }}</span>
                        <span class="icon book" />
                    </a>
                </div>
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
                        <button class="button secundary" type="button" :disabled="loadingMollie" @click="mollieDashboard">
                            <span class="icon external" />
                            <span>{{ $t('%O0') }}</span>
                        </button>
                    </LoadingButton>

                    <a class="button text" :href="$domains.getDocs('mollie')" target="_blank">
                        <span class="icon book" />
                        <span>{{ $t('Mollie Documentatie') }}</span>
                    </a>
                </p>
                <p class="style-button-bar">
                    <button class="button text" type="button" @click="disconnectMollie">
                        <span class="icon trash" />
                        <span>{{ $t('%5U') }}</span>
                    </button>
                </p>

                <STInputBox v-if="mollieProfiles.length > 1" error-fields="mollieProfile" :error-box="errors.errorBox" class="max" :title="$t(`%O9`)">
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

        <template v-if="payconiqApiKey || forcePayconiq">
            <hr>
            <aside class="style-title-prefix">
                {{ $t('Payconiq') }}
            </aside>
            <h2>{{ $t('%Nq') }}</h2>
            <p>
                {{ $t('%Nr') }} <a :href="$domains.getDocs('payconiq')" target="_blank" class="inline-link">{{ $t('%19t') }}</a>
            </p>

            <a v-if="payconiqAccount && payconiqAccount.legacyApi" :selectable="true" class="warning-box" :href="$domains.getDocs('oude-payconiq-accounts')" target="_blank">
                {{ $t('Jouw API-key van Payconiq vereist jouw aandacht. Jouw Payconiq acccount is niet overgezet naar het nieuwe handelaarportaal. Je hebt mogelijks enkel een contract met Payconiq voor de sticker oplossing, niet voor de online oplossing. Lees de gids (klik hier) door om dit te verhelpen. We kunnen niet garanderen dat je huidige Payconiq koppeling blijft werken in de toekomst.') }}

                <span class="button text">
                    {{ $t('Meer lezen') }}
                </span>
            </a>

            <STInputBox error-fields="payconiqApiKey" :error-box="errors.errorBox" class="max" :title="$t(`%K9`)">
                <input v-model="payconiqApiKey" class="input" type="text" :placeholder="$t(`%O8`)">
            </STInputBox>
            <p v-if="payconiqAccount && payconiqAccount.name" class="style-description-small">
                {{ $t('%Ns') }} {{ payconiqAccount.name }}, {{ payconiqAccount.iban }}
            </p>
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
                    <STInputBox error-fields="buckarooSettings.key" :error-box="errors.errorBox" class="max" :title="$t(`%2G`)">
                        <input v-model="buckarooKey" class="input" type="text" :placeholder="$t(`%2G`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('%O5') }}
                    </p>
                </div>
                <div>
                    <STInputBox error-fields="buckarooSettings.secret" :error-box="errors.errorBox" class="max" :title="$t(`%Y`)">
                        <input v-model="buckarooSecret" class="input" type="text" :placeholder="$t(`%Y`)">
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('%O6') }}
                    </p>
                </div>
            </div>

            <hr v-if="stripeAccounts.length">

            <code v-for="account of stripeAccounts" :key="'code-'+account.id" class="style-code" v-text="formatJson(account.meta.blob)" />
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss, useUrl } from '@simonbackx/vue-app-navigation';
import { useContext, useErrors, useFeatureFlag, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage, CenteredMessageButton } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import { BuckarooSettings, CheckMollieResponse, Country, MollieProfile, Organization, OrganizationPrivateMetaData, PayconiqAccount, PaymentMethod, StripeAccount } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const loadingMollie = ref(false);
const loadingStripeAccounts = ref(true);
const creatingStripeAccount = ref(false);
const stripeAccounts = ref<StripeAccount[]>([]);
const mollieProfiles = ref<MollieProfile[]>([]);
const organization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const owner = useRequestOwner();
const featureFlag = useFeatureFlag();
const context = useContext();
const dismiss = useDismiss();
const url = useUrl();

const { patched: patchedOrganization, patch: organizationPatch, hasChanges, addPatch, reset: resetPatch } = usePatch(organization);

const selectedMollieProfile = computed({
    get: () => patchedOrganization.value.privateMeta?.mollieProfile?.id ?? null,
    set: (id: string | null) => {
        const profile = mollieProfiles.value.find(p => p.id === id);
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                mollieProfile: profile ?? null,
            }),
        });
    },
});

const canCreateMultipleStripeAccounts = computed(() => {
    // Check if all current stripe accounts are connected
    return stripeAccounts.value.every(a => (a.meta.charges_enabled && a.meta.payouts_enabled) || (a.meta.details_submitted));
});

const isBelgium = computed(() => {
    return patchedOrganization.value.address.country === Country.Belgium;
});

const isStamhoofd = computed(() => organizationManager.value.user.email.endsWith('@stamhoofd.be') || organizationManager.value.user.email.endsWith('@stamhoofd.nl'));

function formatJson(blob: any) {
    return JSON.stringify(blob, null, 2);
}

const payconiqAccount = computed(() => {
    return patchedOrganization.value.privateMeta?.payconiqAccounts[0] ?? null;
});

const payconiqApiKey = computed({
    get: () => {
        return patchedOrganization.value.privateMeta?.payconiqApiKey ?? '';
    },
    set: (value: string) => {
        if (payconiqApiKey.value && value.length === 0) {
            forcePayconiq.value = true;
        }

        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                payconiqAccounts: (value.length === 0 ? [] : [PayconiqAccount.create({ apiKey: value })]) as any,
            }),
        });
    },
});

const enableBuckaroo = computed({
    get: () => (patchedOrganization.value.privateMeta?.buckarooSettings ?? null) !== null,
    set: (enable: boolean) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: enable ? BuckarooSettings.create({}) : null,
            }),
        });
    },
});

const buckarooKey = computed({
    get: () => patchedOrganization.value.privateMeta?.buckarooSettings?.key ?? '',
    set: (key: string) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    key,
                }),
            }),
        });
    },
});

const buckarooSecret = computed({
    get: () => patchedOrganization.value.privateMeta?.buckarooSettings?.secret ?? '',
    set: (secret: string) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    secret,
                }),
            }),
        });
    },
});

const forcePayconiq = computed({
    get: () => featureFlag('forcePayconiq'),
    set: (forcePayconiq: boolean) => {
        setFeatureFlag('forcePayconiq', forcePayconiq);
    },
});

function setFeatureFlag(flag: string, value: boolean) {
    const featureFlags = patchedOrganization.value.privateMeta?.featureFlags.filter(f => f !== flag) ?? [];
    if (value) {
        featureFlags.push(flag);
    }
    addPatch({
        privateMeta: OrganizationPrivateMetaData.patch({
            featureFlags: featureFlags as any,
        }),
    });
}

const payconiqActive = computed(() => (patchedOrganization.value.privateMeta?.payconiqApiKey ?? '').length > 0);

const isBuckarooActive = computed(() => enableBuckaroo.value && (patchedOrganization.value.privateMeta?.buckarooSettings?.key ?? '').length > 0 && (patchedOrganization.value.privateMeta?.buckarooSettings?.secret ?? '').length > 0);

const buckarooPaymentMethodsString = computed(() => {
    let methods = buckarooPaymentMethods.value;

    if (payconiqActive.value) {
        // Remove Payconiq if has direct link
        methods = methods.filter(m => m !== PaymentMethod.Payconiq);
    }
    return Formatter.joinLast(methods, ', ', ' en ');
});

const buckarooPaymentMethods = computed(() => {
    return patchedOrganization.value.privateMeta?.buckarooSettings?.paymentMethods ?? [];
});

const useTestPayments = computed({
    get: () => patchedOrganization.value.privateMeta?.useTestPayments ?? STAMHOOFD.environment !== 'production',
    set: (useTestPayments: boolean) => {
        addPatch({
            privateMeta: OrganizationPrivateMetaData.patch({
                // Only save non default value
                useTestPayments: STAMHOOFD.environment !== 'production' === useTestPayments ? null : useTestPayments,
            }),
        });
    },
});

async function save() {
    if (saving.value) {
        return;
    }

    const simpleErrors = new SimpleErrors();

    let valid = false;

    if (simpleErrors.errors.length > 0) {
        errors.errorBox = new ErrorBox(errors);
    }
    else {
        errors.errorBox = null;
        valid = true;
    }
    valid = valid && await errors.validator.validate();

    if (!valid) {
        return;
    }

    saving.value = true;

    try {
        await organizationManager.value.patch(organizationPatch.value);
        resetPatch();
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

let didReadMollie = false;

async function linkMollie() {
    const time = new Date();
    if (!await CenteredMessage.confirm($t('Let op met wat je invult'), $t('Ja, gelezen'), $t('Je moet soms documenten uploaden in Mollie die enkel in onze documentatie te vinden zijn. Zonder een nieuw account kunnen ook hogere transactiekosten gelden.\n\nLees daarom eerst de documentatie: fouten kunnen leiden tot afkeuring van je aansluiting en een aanzienlijk langere doorlooptijd.'))) {
        return;
    }
    const end = new Date();

    if (!didReadMollie && end.getTime() - time.getTime() < 5_000) {
        new Toast($t('Koppel Mollie niet als je gehaast bent. Je hebt in minder dan 5 seconden doorgeklikt, je had nooit alle waarschuwingen kunnen lezen. We doen dit voor je eigen bestwil.'), 'error red').setHide(10_000).show();
        return;
    }
    didReadMollie = true;

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

async function disconnectMollie() {
    if (await CenteredMessage.confirm('Ben je zeker dat je Mollie wilt loskoppelen?', 'Ja, loskoppelen', 'Jouw Mollie account blijft behouden en kan je later terug koppelen als je dat wilt.')) {
        try {
            const response = await context.value.authenticatedServer.request({
                method: 'POST',
                path: '/mollie/disconnect',
                decoder: Organization as Decoder<Organization>,
                owner,
                shouldRetry: false,
            });

            context.value.updateOrganization(response.data);
            new Toast('Mollie is losgekoppeld', 'success green').show();
        }
        catch (e) {
            new Toast('Loskoppelen mislukt', 'error red').show();
        }
    }
}

async function doLinkMollie(code: string, state: string) {
    const toast = new Toast('Koppelen...', 'spinner').setHide(null).show();

    try {
        const savedState = await Storage.keyValue.getItem('mollie-saved-state');
        if (savedState !== state) {
            throw new SimpleError({
                code: 'state_verification_failed',
                message: 'State is not the same',
                human: 'Er ging iets mis bij het koppelen. Een onbekende pagina probeerde Mollie te koppelen. Contacteer ons via ' + $t('%2a') + ' als je Mollie probeert te koppelen en het blijft mislukken.',
            });
        }
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/mollie/connect',
            body: {
                code,
            },
            decoder: Organization as Decoder<Organization>,
            owner,
            shouldRetry: false,
        });

        context.value.updateOrganization(response.data);
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

    updateMollie().catch(console.error);
}

let lastAddedStripeAccount: string | null = null;

onMounted(() => {
    const urlParams = UrlHelper.shared.getSearchParams();

    const mollieMatch = url.match('/oauth/mollie');
    if (mollieMatch) {
        const code = mollieMatch.query.get('code');
        const state = mollieMatch.query.get('state');

        if (code && state) {
            doLinkMollie(code, state).catch(console.error);
        }
        else {
            const error = mollieMatch.query.get('error') ?? '';
            if (error) {
                new Toast('Koppelen mislukt', 'error red').show();
            }
            updateMollie().catch(console.error);
        }
    }
    else {
        if ((patchedOrganization.value.privateMeta && patchedOrganization.value.privateMeta.mollieOnboarding) || featureFlag('forceMollie')) {
            updateMollie().catch(console.error);
        }
    }
    lastAddedStripeAccount = urlParams.get('recheck-stripe-account');
    doRefresh();
    refreshOnReturn();
});

function doRefresh() {
    loadStripeAccounts(lastAddedStripeAccount).catch(console.error);
}

function refreshOnReturn() {
    document.addEventListener('visibilitychange', doRefresh);
}

async function loadStripeAccounts(recheckStripeAccount: string | null) {
    try {
        loadingStripeAccounts.value = true;
        if (recheckStripeAccount) {
            try {
                await context.value.authenticatedServer.request({
                    method: 'POST',
                    path: '/stripe/accounts/' + encodeURIComponent(recheckStripeAccount),
                    decoder: StripeAccount as Decoder<StripeAccount>,
                    owner,
                });
            }
            catch (e) {
                console.error(e);
            }
        }
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/accounts',
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            owner,
        });
        stripeAccounts.value = response.data;

        if (!recheckStripeAccount) {
            for (const account of stripeAccounts.value) {
                try {
                    const response = await context.value.authenticatedServer.request({
                        method: 'POST',
                        path: '/stripe/accounts/' + encodeURIComponent(account.id),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner,
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
    loadingStripeAccounts.value = false;
}

const hasDuplicateNames = computed(() => {
    for (const account of stripeAccounts.value) {
        if (stripeAccounts.value.find(a => a.id !== account.id && a.meta.settings.dashboard.display_name === account.meta.settings.dashboard.display_name)) {
            return true;
        }
    }
    return false;
});

function editStripeAccount(account: StripeAccount) {
    new CenteredMessage('Stripe Dashboard', 'Je kan alle gegevens wijzigen via je Stripe Dashboard. Bovenaan klik je daar op het gebruikersicoontje > Platforminstellingen om gegevens aan te passen.')
        .addButton(
            new CenteredMessageButton('Openen', {
                action: async () => {
                    await loginStripeAccount(account.id);
                },
            }),
        )
        .addCloseButton()
        .show();
}

let didReadStripe = false;

async function createStripeAccount() {
    if (isBelgium.value) {
        const time = new Date();
        if ((!await CenteredMessage.confirm('Let op met wat je invult', 'Ja, gelezen', '- Selecteer de juiste bedrijfsvorm in Stripe\n- Heb je geen VZW maar een feitelijke vereniging? Selecteer dan \'Vereniging ZONDER rechtspersoonlijkheid\'. Je kan dit later niet meer wijzigen.\n- Vul alles correct en volledig in zoals gevraagd, neem je tijd\n- Vul zeker een websiteadres in.\n- Je vindt templates en info in de documentatie, ga eerst daarheen als je twijfelt.\n- Upload enkel documenten die in de lijst staan van toegestane documenten.'))) {
            return;
        }

        const end = new Date();

        if (!didReadStripe && end.getTime() - time.getTime() < 5_000) {
            new Toast('Koppel Stripe niet als je gehaast bent. Je hebt in minder dan 5 seconden doorgeklikt, je had nooit alle waarschuwingen kunnen lezen. We doen dit voor je eigen bestwil.', 'error red').setHide(10_000).show();
            return;
        }
        didReadStripe = true;
    }

    let tab: Window | null = null;
    try {
        tab = tab ?? (AppManager.shared.isNative ? null : window.open('about:blank'));
        creatingStripeAccount.value = true;
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/stripe/connect',
            decoder: StripeAccount as Decoder<StripeAccount>,
            shouldRetry: false,
            owner,
        });
        const account = response.data;
        stripeAccounts.value.push(account);

        // Open connect url
        await openStripeAccountLink(account.id, tab);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
        tab?.close();
    }
    creatingStripeAccount.value = false;
}

async function openStripeAccountLink(accountId: string, initialTab?: Window | null) {
    let tab: Window | null = initialTab ?? null;
    try {
        tab = tab ?? (AppManager.shared.isNative ? null : window.open('about:blank'));

        const helper = new UrlHelper();
        helper.getSearchParams().append('recheck-stripe-account', accountId);

        // Override domain (required for native app)
        helper.setDomain(patchedOrganization.value.dashboardDomain);
        lastAddedStripeAccount = accountId;

        class ResponseBody extends AutoEncoder {
            @field({ decoder: StringDecoder })
            url: string;
        }

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            body: {
                accountId: accountId,
                returnUrl: helper.getFullHref(),
                refreshUrl: helper.getFullHref(),
            },
            path: '/stripe/account-link',
            decoder: ResponseBody as Decoder<ResponseBody>,
            owner,
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

async function deleteStripeAccount(accountId: string) {
    if (!(await CenteredMessage.confirm('Dit account verwijderen?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
        return;
    }

    if (!(await CenteredMessage.confirm('Heel zeker?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
        return;
    }

    try {
        await context.value.authenticatedServer.request({
            method: 'DELETE',
            path: '/stripe/accounts/' + encodeURIComponent(accountId),
            owner,
        });
        stripeAccounts.value = stripeAccounts.value.filter(a => a.id !== accountId);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

async function loginStripeAccount(accountId: string) {
    let tab: Window | null = null;
    try {
        // Immediately open a new tab (otherwise blocked!)
        tab = (AppManager.shared.isNative ? null : window.open('about:blank'));

        class ResponseBody extends AutoEncoder {
            @field({ decoder: StringDecoder })
            url: string;
        }

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            body: {
                accountId: accountId,
            },
            path: '/stripe/login-link',
            decoder: ResponseBody as Decoder<ResponseBody>,
            owner,
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

async function updateMollie() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/mollie/check',
            decoder: CheckMollieResponse as Decoder<CheckMollieResponse>,
            shouldRetry: false,
            owner,
        });

        mollieProfiles.value = response.data.profiles;
        context.value.updateOrganization(response.data.organization);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

async function mollieDashboard() {
    if (loadingMollie.value) {
        return;
    }
    loadingMollie.value = true;

    const tab = (AppManager.shared.isNative ? null : window.open('about:blank'));

    if (!tab && !AppManager.shared.isNative) {
        loadingMollie.value = false;
        new Toast('Kon geen scherm openen', 'error red').show();
        return;
    }

    try {
        const url = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/mollie/dashboard',
            shouldRetry: false,
            owner,
        });

        if (AppManager.shared.isNative) {
            window.open(url.data);
        }
        else {
            tab!.location = url.data as any;
            tab!.focus();
        }
    }
    catch (e) {
        await updateMollie();
        tab?.close();
        errors.errorBox = new ErrorBox(e);
    }

    loadingMollie.value = false;
}

onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', doRefresh);
});

defineExpose({
    shouldNavigateAway,
});
</script>
