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
                    <p class="style-description">
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
                    <p class="style-description">
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
                    <p class="style-description">
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
                    <p class="style-description">
                        {{ $t('%Ok') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRegistrationPeriods)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/calendar.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3i') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3e') }}
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
                    <p class="style-description">
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
                    <p class="style-description">
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
                    <p class="style-description">
                        {{ $t('%Ol') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="membersPackage">
                <hr><h2>{{ $t('%Om') }}</h2>

                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%On') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Oo') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.RegistrationPaymentMethods)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%41') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%2p') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationGroups)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/group.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Op') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Oq') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.BundleDiscounts)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%15q') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%15r') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationRecords)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/health-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Or') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Os') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationFreeContributions)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/piggy-bank.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Ot') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Ou') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="$feature('members-import')" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.MembersImport)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/import-excel.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%18D') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%18d') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('%1EO') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1EJ') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%Ov') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailTemplates)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1DD') }}
                    </h2>
                    <p class="style-description">
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
                    <p class="style-description">
                        {{ $t('%Ow') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="feature('sso')">
                <hr><h2>{{ $t('%HQ') }}</h2>
                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%2b') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%HS') }}
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
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Packages)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/stock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1HV') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%1HW') }}
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
                        <p class="style-description">
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
                        <p class="style-description">
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
import BundleDiscountSettingsView from '@stamhoofd/components/bundle-discounts/BundleDiscountSettingsView.vue';
import EditEmailTemplatesView from '@stamhoofd/components/email/EditEmailTemplatesView.vue';
import EditRegistrationPeriodsView from '@stamhoofd/components/periods/EditRegistrationPeriodsView.vue';
import EmailSettingsView from '@stamhoofd/components/email/EmailSettingsView.vue';
import GeneralSettingsView from '@stamhoofd/components/organizations/GeneralSettingsView.vue';
import RecordsConfigurationView from '@stamhoofd/components/records/RecordsConfigurationView.vue';
import SSOSettingsView from '@stamhoofd/components/auth/SSOSettingsView.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useMembersPackage } from '@stamhoofd/components/hooks/useMembersPackage.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useSalesDisabled } from '@stamhoofd/components/hooks/useSalesDisabled.ts';

import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { useOrganizationManager, usePatchOrganizationPeriod, useRequestOwner } from '@stamhoofd/networking';
import { EmailTemplate, EmailTemplateType, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, OrganizationRegistrationPeriod, StripeAccount } from '@stamhoofd/structures';
import { ComponentOptions, Ref, computed, ref } from 'vue';
import BalanceNotificationSettingsView from './BalanceNotificationSettingsView.vue';
import LabsView from './LabsView.vue';
import PaymentSettingsView from './PaymentSettingsView.vue';
import PersonalizeSettingsView from './PersonalizeSettingsView.vue';
import PremisesView from './PremisesView.vue';
import PrivacySettingsView from './PrivacySettingsView.vue';
import RegistrationPageSettingsView from './RegistrationPageSettingsView.vue';
import RegistrationPaymentSettingsView from './RegistrationPaymentSettingsView.vue';
import UitpasSettingsView from './UitpasSettingsView.vue';
import { useEditGroupsView } from './hooks/useEditGroupsView';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import ImportMembersView from './modules/members/ImportMembersView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import PackageSettingsView from './packages/PackageSettingsView.vue';

type ttt = FreeContributionSettingsView;

enum Routes {
    General = 'algemeen',
    Personalization = 'personaliseren',
    Privacy = 'privacy',
    PaymentAccounts = 'betaal-accounts',
    Admins = 'beheerders',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    RegistrationPaymentMethods = 'inschrijvingen/betaalmethodes',
    RegistrationPage = 'inschrijvingen/pagina',
    RegistrationGroups = 'inschrijvingen/groepen',
    BundleDiscounts = 'inschrijvingen/kortingen',
    RegistrationRecords = 'inschrijvingen/persoonsgegevens',
    RegistrationFreeContributions = 'inschrijvingen/vrije-bijdrage',
    SingleSignOn = 'sso',
    Packages = 'pakketten',
    Referrals = 'referrals',
    Labs = 'experimenten',
    Premises = 'lokalen',
    BalanceNotifications = 'openstaande-bedragen-notificaties',
    MembersImport = 'leden-importeren',
    Uitpas = 'uitpas',
    OrganizationRegistrationPeriods = 'werkjaren',
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();
const buildEditGroupsView = useEditGroupsView();
const organization = useOrganization();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const uitpasFeature = useFeatureFlag()('uitpas');

defineRoutes([
    {
        url: Routes.General,
        component: GeneralSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Personalization,
        component: PersonalizeSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Privacy,
        component: PrivacySettingsView,
        present: 'popup',
    },
    {
        url: Routes.PaymentAccounts,
        component: PaymentSettingsView,
        present: 'popup',
    },
    {
        url: Routes.Admins,
        component: AdminsView as ComponentOptions,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: EditEmailTemplatesView as ComponentOptions,
        paramsToProps() {
            return {
                types: [...Object.values(EmailTemplateType)].filter((t) => {
                    // Do not show balance reminder email templates for organizations if disabled
                    if (!$organizationManager.value.organization.privateMeta?.featureFlags.includes('organization-receivable-balances')
                        && [EmailTemplateType.OrganizationBalanceIncreaseNotification, EmailTemplateType.OrganizationBalanceReminder].includes(t)) {
                        return false;
                    }

                    return EmailTemplate.allowOrganizationLevel(t);
                }),
            };
        },
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: EmailSettingsView as ComponentOptions,
    },
    {
        url: Routes.RegistrationPaymentMethods,
        present: 'popup',
        component: RegistrationPaymentSettingsView,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: RegistrationPageSettingsView,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        handler: async (options) => {
            const component = await buildEditGroupsView();

            await present({
                ...(options as any),
                components: [component],
            });
        },
    },
    {
        url: Routes.BundleDiscounts,
        present: 'popup',
        component: BundleDiscountSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                period: organization.value!.period,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = organization.value!.period.id;
                    await patchOrganizationPeriod(patch);
                },
            };
        },
    },
    {
        url: Routes.RegistrationRecords,
        present: 'popup',
        component: RecordsConfigurationView as ComponentOptions,
        paramsToProps() {
            return {
                inheritedRecordsConfiguration: OrganizationRecordsConfiguration.build({ platform: platform.value }),
                recordsConfiguration: $organizationManager.value.organization.meta.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await $organizationManager.value.patch(Organization.patch({
                        id: $organizationManager.value.organization.id,
                        meta: OrganizationMetaData.patch({
                            recordsConfiguration: patch,
                        }),
                    }));
                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
    },
    {
        url: Routes.RegistrationFreeContributions,
        present: 'popup',
        component: FreeContributionSettingsView,
    },
    {
        url: Routes.SingleSignOn,
        present: 'popup',
        component: SSOSettingsView,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: LabsView,
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
        url: Routes.MembersImport,
        present: 'popup',
        component: ImportMembersView,
    },
    {
        url: Routes.Uitpas,
        present: 'popup',
        component: UitpasSettingsView,
    },
    {
        url: Routes.OrganizationRegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView as ComponentOptions,
    },
    ...(!isPlatform
        ? [
                {
                    url: Routes.Packages,
                    present: 'popup' as const,
                    component: PackageSettingsView as ComponentOptions,
                },
            ]
        : []),
]);

const $navigate = useNavigate();
const stripeAccounts = ref([]) as Ref<StripeAccount[]>;
const loadingStripeAccounts = ref(false);
const context = useContext();
const owner = useRequestOwner();
const feature = useFeatureFlag();
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

</script>
