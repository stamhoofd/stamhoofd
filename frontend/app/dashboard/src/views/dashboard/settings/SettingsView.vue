<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`88136719-d85f-499f-8c5f-252519947c03`)" />

        <main class="center">
            <h1>
                {{ $t('bab38c80-8ab6-4cb7-80c3-1f607057e45d') }}
            </h1>

            <BillingWarningBox />

            <p v-for="(stripeWarning, index) of stripeWarnings" :key="'stripe-warning-'+index" :class="stripeWarning.type + '-box'">
                {{ stripeWarning.text }}

                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}
                </a>
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.General)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('35757756-d817-419d-82dd-1ba14128af30') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f042b512-f374-4088-9175-955f62575744') }}
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
                        {{ $t('f45871aa-7723-42c3-9781-f4f9b8d7250a') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('d07dd246-d0b6-4941-a015-a7d305fd8e1c') }}
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
                        {{ $t('30ea5656-b3df-4b67-9f8c-2d71924f7eee') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c1b71652-5398-4398-8185-0d80e09c9827') }}
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
                        {{ $t('9f4f2cef-7466-42e3-bca3-d3bfd9f29aa4') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('518e8449-5f7e-4493-b724-4a4d32efc40b') }}
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
                        {{ $t('46c3ece9-3197-4668-9528-b1258b77e789') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('eec0bece-8f7a-4da4-8943-d6eef7cd7c31') }}
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
                        {{ $t('eecb4cc5-f807-4325-8083-1fe893756ce4') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('52f90401-117a-42e7-b500-f13db35f23a4') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="membersPackage">
                <hr><h2>{{ $t('64d8c751-a6c4-427e-b3db-cef827058780') }}</h2>

                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('7e571340-71b3-4d22-8c01-c895ee0997a4') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('ab663eb3-5e1b-4876-8e85-c0ffadd5ab3b') }}
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
                            {{ $t('741fa4dc-7001-40d6-b1d2-cd3c88334607') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c42e02a5-8d91-47fd-98b8-c2407119b41d') }}
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
                            {{ $t('30ceddd4-0f32-4d92-b42e-f2d8ffeebb2a') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('cfa83be3-964c-46ca-95e8-0ee74e2e8389') }}
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
                            {{ $t('98237c41-e107-4997-a645-cc4c16bb5b9a') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('86fbcc70-2118-4399-9b7c-4461b8d40369') }}
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
                            {{ $t('15e411ef-7a28-41e0-ad90-8c6ffae730f1') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('9cd854d2-c290-4169-aedc-35cabb608198') }}
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
                            {{ $t('16ca0372-9c8f-49f0-938d-aee012e59f8c') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('45193033-dfd3-4dff-a7a6-cf4bd0883b5e') }}
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
                            {{ $t('Leden importeren') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('Importeer leden vanaf een Excel of CSV bestand') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('cce92c4c-1cdf-4a22-9f1a-89f888046cde') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('7766ee8a-cd92-4d6f-a3fa-f79504fbcdda') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('5c0e8dda-122a-4ec9-a3ca-f8dcb2593fc7') }}
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
                        {{ $t('f0b50a39-d4fd-4f97-802d-a599b00030fd') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('ba4eeb34-6c93-4537-92ac-ea4f30c28fbb') }}
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
                        {{ $t('4539b2ba-71f8-4839-aee8-60da1189b520') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('4abf9650-55e0-45ad-8412-7570ac42117f') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="feature('sso')">
                <hr><h2>{{ $t('6a11d3a7-6348-4aca-893e-0f026e5eb8b0') }}</h2>
                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('662467b7-da51-4fe2-bff4-784c8f028e58') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('1a4edf37-9d52-4a9d-b535-5e098236a61e') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="!salesDisabled">
                <hr><h2>{{ $t('405a811e-ebb1-4948-84cd-8fb5860104e6') }}</h2>
                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Packages)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/stock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('dd8f3b31-064c-4391-9352-6ec9c15bd9a8') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d772b39b-b319-45ea-8b4b-2448b75ac54d') }}
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
                            {{ $t("0208e14e-b26e-4411-9e8e-461b63b1c0c1") }}
                        </h2>
                        <p class="style-description">
                            {{ $t('141a681a-da48-45e8-a37f-058eb042d841') }}
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
                            {{ $t('5a5c1ed2-516e-43a1-9e64-25a7f6190ed3') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('0e276c36-671b-442a-89a0-ad87f5a947f3') }}
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
import { AdminsView, BundleDiscountSettingsView, EditEmailTemplatesView, EmailSettingsView, GeneralSettingsView, RecordsConfigurationView, SSOSettingsView, STList, STListItem, STNavigationBar, Toast, useContext, useFeatureFlag, useMembersPackage, useOrganization, usePlatform, useSalesDisabled } from '@stamhoofd/components';

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
import { useEditGroupsView } from './hooks/useEditGroupsView';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import ImportMembersView from './modules/members/ImportMembersView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';

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
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();
const buildEditGroupsView = useEditGroupsView();
const organization = useOrganization();
const patchOrganizationPeriod = usePatchOrganizationPeriod();

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
            const component = buildEditGroupsView();

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
