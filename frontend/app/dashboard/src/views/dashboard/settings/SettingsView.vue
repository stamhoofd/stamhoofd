<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`%xU`)" />

        <main class="center">
            <h1>
                {{ $t('%xU') }}
            </h1>

            <BillingWarningBox />

            <p v-for="(stripeWarning, index) of stripeWarnings" :key="'stripe-warning-'+index" :class="stripeWarning.type + '-box'">
                {{ stripeWarning.text }}

                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('%19t') }}
                </a>
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.General)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%Lb') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Of') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Personalization)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%ty') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Og') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Admins)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/admin.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%Oh') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Oi') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Privacy)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%Oj') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ok') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PaymentAccounts)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%40') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%3z') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="uitpasFeature" :selectable="true" class="left-center" @click="$navigate(Routes.Uitpas)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/uitpas.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ true ? $t('%1Bf') : $t('%1Bg') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Bh') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isShowPremises" :selectable="true" class="left-center" @click="$navigate(Routes.Premises)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/house.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%6c') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ol') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="organization?.meta.invoicesEnabled" :selectable="true" class="left-center" @click="$navigate(Routes.Invoices)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/transfer-outgoing.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1Tp') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Rv') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="membersPackage" :selectable="true" class="left-center" @click="$navigate(Routes.Members)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Ledenadministratie') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('Stel je betaalmethodes voor inschrijvingen, onderverdelingen, kortingen, persoonsgegevens en meer in.') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%1EO') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1EJ') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ov') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" data-testid="OpenEmailTemplatesSettingsButton" @click="$navigate(Routes.EmailTemplates)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1DD') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%HO') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.BalanceNotifications)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/notifications.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%HH') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ow') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="$feature('sso')">
                <hr><h2>{{ $t('%HQ') }}</h2>
                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%2b') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('Configureer Single-Sign-On voor webshop authenticatie. Dit werkt momenteel nog niet voor ledenlogin.') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="!salesDisabled">
                <hr><h2>{{ $t('%q') }}</h2>
                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" data-testid="open-packages-button" @click="$navigate(Routes.Packages)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/stock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1HV') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%1HW') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.PaymentSettings)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1S7') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%1UG') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Referrals)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/credits.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t("%5R") }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%Ox') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Labs)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/experiment.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%HD') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%HR') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import AdminsView from '@stamhoofd/components/admins/AdminsView.vue';
import LoginMethodSettingsView from '@stamhoofd/components/auth/LoginMethodSettingsView.vue';
import EditEmailTemplatesView from '@stamhoofd/components/email/EditEmailTemplatesView.vue';
import EmailSettingsView from '@stamhoofd/components/email/EmailSettingsView.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useMembersPackage } from '@stamhoofd/components/hooks/useMembersPackage.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useSalesDisabled } from '@stamhoofd/components/hooks/useSalesDisabled.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import GeneralSettingsView from '@stamhoofd/components/organizations/GeneralSettingsView.vue';
import { usePatchOrganization } from '@stamhoofd/components/organizations/usePatchOrganization';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import EditRegistrationPeriodsView from '@stamhoofd/components/periods/EditRegistrationPeriodsView.vue';

import type { AutoEncoderPatchType, ConvertArrayToPatchableArray, Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { DataPermissionSettingsView, FinancialSupportSettingsView } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { DataPermissionsSettings, DetailedPayableBalance, EmailTemplate, EmailTemplateType, FinancialSupportSettings, getDataPermissionSettingsOrDefault, getFinancialSupportSettingsOrDefault, LoginMethod, LoginMethodConfig, LoginProviderType, Organization, OrganizationMetaData, StripeAccount } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import BalanceNotificationSettingsView from './BalanceNotificationSettingsView.vue';
import BillingSettingsView from './BillingSettingsView.vue';
import InvoiceSettingsView from './InvoiceSettingsView.vue';
import LabsView from './LabsView.vue';
import MembersSettingsView from './MembersSettingsView.vue';
import PaymentSettingsView from './PaymentSettingsView.vue';
import PersonalizeSettingsView from './PersonalizeSettingsView.vue';
import PremisesView from './PremisesView.vue';
import PrivacySettingsView from './PrivacySettingsView.vue';
import ReferralView from './ReferralView.vue';
import UitpasSettingsView from './UitpasSettingsView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import PackageSettingsView from './packages/PackageSettingsView.vue';

enum Routes {
    General = 'algemeen',
    Personalization = 'personaliseren',
    Privacy = 'privacy',
    PaymentAccounts = 'betaal-accounts',
    Admins = 'beheerders',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    SingleSignOn = 'sso',
    Packages = 'functionaliteiten',
    PaymentSettings = 'betalingen',
    Referrals = 'referrals',
    Labs = 'experimenten',
    Premises = 'lokalen',
    BalanceNotifications = 'openstaande-bedragen-notificaties',
    Members = 'ledenadministratie',
    Uitpas = 'uitpas',
    OrganizationRegistrationPeriods = 'werkjaren',
    FinancialSupport = 'financiele-ondersteuning',
    DataPermissions = 'toestemming-gegevensverzameling',
    Invoices = 'uitgaande-facturen',
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const organization = useRequiredOrganization();
const patchOrganization = usePatchOrganization();
const uitpasFeature = useFeatureFlag()('uitpas');

defineRoutes([
    {
        url: Routes.General,
        component: GeneralSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Members,
        component: MembersSettingsView,
    },
    {
        url: Routes.Personalization,
        component: () => PersonalizeSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Privacy,
        component: () => PrivacySettingsView,
        present: 'popup',
    },
    {
        url: Routes.PaymentAccounts,
        component: PaymentSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Invoices,
        component: InvoiceSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Admins,
        component: AdminsView,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: EditEmailTemplatesView,
        paramsToProps() {
            return {
                types: [...Object.values(EmailTemplateType)].filter((t) => {
                    return EmailTemplate.allowOrganizationLevel(t, organization.value, platform.value);
                }),
            };
        },
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: EmailSettingsView,
    },
    {
        url: Routes.SingleSignOn,
        present: 'popup',
        component: LoginMethodSettingsView,
        paramsToProps() {
            return {
                loginMethod: LoginMethod.SSO,
                title: $t('%2b'),
                configs: organization.value.meta.loginMethods,
                provider: LoginProviderType.SSO,
                showDisplaySettings: false,
                description: $t('Configureer Single-Sign-On voor webshop authenticatie. Dit werkt momenteel nog niet voor ledenlogin.'),
                saveHandler: async (loginMethods: ConvertArrayToPatchableArray<Map<LoginMethod, LoginMethodConfig>>) => {
                    await patchOrganization(Organization.patch({
                        meta: OrganizationMetaData.patch({
                            loginMethods,
                        }),
                    }));
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: () => LabsView,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView,
    },
    {
        url: Routes.BalanceNotifications,
        present: 'popup',
        component: BalanceNotificationSettingsView,
    },
    {
        url: Routes.Uitpas,
        present: 'popup',
        component: UitpasSettingsView,
    },
    {
        url: Routes.OrganizationRegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView,
    },
    ...(!isPlatform
        ? [
                {
                    url: Routes.Packages,
                    present: 'popup' as const,
                    component: PackageSettingsView,
                },
                {
                    url: Routes.Referrals,
                    present: 'popup' as const,
                    component: ReferralView,
                },
                {
                    url: Routes.PaymentSettings,
                    present: 'popup' as const,
                    component: BillingSettingsView,
                    async paramsToProps() {
                        const item = await loadPayableBalance();

                        return {
                            item,
                        };
                    },
                },
                {
                    name: Routes.FinancialSupport,
                    url: 'financiele-ondersteuning',
                    component: FinancialSupportSettingsView,
                    paramsToProps() {
                        return {
                            financialSupport: getFinancialSupportSettingsOrDefault(platform.value, organization.value),
                            saveHandler: async (patch: AutoEncoderPatchType<FinancialSupportSettings>) => {
                                const isNew = !organization.value?.meta.financialSupport;
                                await $organizationManager.value.patch(Organization.patch({
                                    meta: OrganizationMetaData.patch({
                                        financialSupport: isNew ? FinancialSupportSettings.create({}).patch(patch) : patch,
                                    }),
                                }));
                                Toast.success($t(`%HU`)).show();
                            },
                        };
                    },
                    present: 'popup' as const,
                },
                {
                    name: Routes.DataPermissions,
                    url: 'toestemming-gegevensverzameling',
                    component: DataPermissionSettingsView,
                    paramsToProps() {
                        return {
                            dataPermission: getDataPermissionSettingsOrDefault(platform.value, organization.value),
                            saveHandler: async (patch: AutoEncoderPatchType<DataPermissionsSettings>) => {
                                const isNew = !organization.value?.meta.dataPermission;
                                await $organizationManager.value.patch(Organization.patch({
                                    meta: OrganizationMetaData.patch({
                                        dataPermission: isNew ? DataPermissionsSettings.create({}).patch(patch) : patch,
                                    }),
                                }));
                                Toast.success($t(`%HU`)).show();
                            },
                        };
                    },
                    present: 'popup' as const,
                },
            ]
        : []),
]);

const $navigate = useNavigate();
const stripeAccounts = ref([]) as Ref<StripeAccount[]>;
const loadingStripeAccounts = ref(false);
const context = useContext();
const owner = useRequestOwner();
const stripeWarnings = computed(() => {
    return stripeAccounts.value.flatMap(a => a.warning ? [a.warning] : []);
});

const salesDisabled = useSalesDisabled();
const membersPackage = useMembersPackage();
loadStripeAccounts(null).catch(console.error);

const isShowPremises = computed(() => {
    if (platform.value.config.premiseTypes.length > 0) {
        return true;
    }
    const premises = $organizationManager.value.organization.privateMeta?.premises;
    return premises && premises.length > 0;
});

// Fetch balance
async function loadPayableBalance() {
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: `/billing/${platform.value.membershipOrganizationId}/payable-balance`,
        decoder: DetailedPayableBalance as Decoder<DetailedPayableBalance>,
        shouldRetry: false,
        owner,
        timeout: 10_000,
    });

    return response.data;
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
            } catch (e) {
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
                } catch (e) {
                    console.error(e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    loadingStripeAccounts.value = false;
}

</script>
