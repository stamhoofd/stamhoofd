<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Instellingen`)"/>

        <main class="center">
            <h1>
                {{ $t('a370eff9-c1c1-450c-8bdb-dcee89bd2f70') }}
            </h1>

            <BillingWarningBox/>

            <p v-for="(stripeWarning, index) of stripeWarnings" :key="'stripe-warning-'+index" :class="stripeWarning.type + '-box'">
                {{ stripeWarning.text }}

                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}
                </a>
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.General)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/flag.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('f8ce21aa-06de-4373-874c-ddad1629cad8') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c436c107-10af-4e56-9548-7410d9e0606f') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Personalization)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/palette.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('ba0f4e0a-0e1e-4fd2-8078-2ff1956e3396') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f84fd3a8-7ee5-48f3-8a2b-5bac01c2b4a6') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Admins)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('da4db094-011d-4471-b362-f146c3e9111c') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('a99c8706-3e99-4d6e-8a0e-cb7a8abe687a') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Privacy)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('6cde0f7a-669e-459e-9044-8ee584a1b7d8') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('072c5246-794b-4897-9367-41b195dcbb61') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PaymentAccounts)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('46c3ece9-3197-4668-9528-b1258b77e789') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('eec0bece-8f7a-4da4-8943-d6eef7cd7c31') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="isShowPremises" :selectable="true" class="left-center" @click="$navigate(Routes.Premises)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/house.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('491be96d-42c0-4ec2-9306-2308b95790f0') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('eb5fba89-3444-4127-aaf9-d52572751e61') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="membersPackage">
                <hr><h2>{{ $t('d68f5fc3-2e5e-4d4b-88fd-17aee136f145') }}</h2>

                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('65e2f8a7-07a8-4f50-906a-0e040620152d') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('63336e20-76a0-49a2-992a-5fc2e2468537') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.RegistrationPaymentMethods)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('741fa4dc-7001-40d6-b1d2-cd3c88334607') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c42e02a5-8d91-47fd-98b8-c2407119b41d') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationGroups)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/group.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('ea61bd94-60a5-44c6-8691-fde8ef24cadd') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d065761f-5fad-4d61-b91c-72a4d7b1d1db') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationRecords)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/health-data.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('8f90a3c6-4a53-4c35-aee0-4be510f962be') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('a8ea3bbd-4e87-47fc-ba55-8c39ede64271') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationFreeContributions)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/piggy-bank.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('40157aa3-6407-4429-a14a-fb8773df802b') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d3b7901b-fdd4-49a7-b64c-8ed0fe77923f') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('30da2304-9692-43c3-b21f-f2ec241d3a35') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('94a15216-0f44-457e-83a7-0052c1526a01') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f5ba8d14-8af8-4083-88c0-84f8a0cdc531') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailTemplates)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email-template.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('e4e79acd-2538-406e-927c-e18c5383a493') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('dfda7f52-b5bd-4619-b77d-92f589ff2c45') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="$feature('balance-emails')" :selectable="true" class="left-center" @click="$navigate(Routes.BalanceNotifications)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/notifications.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('2bb1f340-6641-4308-a033-3847e696f8b8') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('3461d7cc-6515-443d-b31d-a1883a401fd7') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="feature('sso')">
                <hr><h2>{{ $t('2dfdb75f-fd62-45df-bc9f-a34a5570dd32') }}</h2>
                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('c390b050-b87f-4842-807a-c040dcfa5aaa') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('6cece759-cbba-485a-8fac-1861ad57903b') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="!salesDisabled">
                <hr><h2>{{ $t('405a811e-ebb1-4948-84cd-8fb5860104e6') }}</h2>
                <STList class="illustration-list">
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Packages)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/stock.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('a2e505d6-2a30-4e47-ace9-a1db6cbc440e') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('2a157d11-4529-414c-b72b-4bcd3f43faa5') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Referrals)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/credits.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t("0208e14e-b26e-4411-9e8e-461b63b1c0c1") }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d6b20142-4b1b-44fe-a212-c1e65d6cbc8c') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Labs)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/experiment.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('361fe588-e3b6-41d0-a0fa-b10382b21ae9') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('6b388d49-e43f-45fd-bc8b-fb53b76c32a5') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AdminsView, EditEmailTemplatesView, EmailSettingsView, GeneralSettingsView, RecordsConfigurationView, SSOSettingsView, STList, STListItem, STNavigationBar, Toast, useContext, useFeatureFlag, useMembersPackage, usePlatform, useSalesDisabled } from '@stamhoofd/components';

import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { EmailTemplate, EmailTemplateType, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, StripeAccount } from '@stamhoofd/structures';
import { ComponentOptions, Ref, computed, ref } from 'vue';
import BalanceNotificationSettingsView from './BalanceNotificationSettingsView.vue';
import LabsView from './LabsView.vue';
import PaymentSettingsView from './PaymentSettingsView.vue';
import PersonalizeSettingsView from './PersonalizeSettingsView.vue';
import PremisesView from './PremisesView.vue';
import PrivacySettingsView from './PrivacySettingsView.vue';
import RegistrationPageSettingsView from './RegistrationPageSettingsView.vue';
import RegistrationPaymentSettingsView from './RegistrationPaymentSettingsView.vue';
import { buildManageGroupsComponent } from './buildManageGroupsComponent';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';

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
    RegistrationRecords = 'inschrijvingen/persoonsgegevens',
    RegistrationFreeContributions = 'inschrijvingen/vrije-bijdrage',
    SingleSignOn = 'sso',
    Packages = 'pakketten',
    Referrals = 'referrals',
    Labs = 'experimenten',
    Premises = 'lokalen',
    BalanceNotifications = 'openstaande-bedragen-notificaties',
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();

defineRoutes([
    {
        url: Routes.General,
        component: GeneralSettingsView as ComponentOptions,
        present: 'popup',
    },
    {
        url: Routes.Personalization,
        component: PersonalizeSettingsView as unknown as ComponentOptions,
        present: 'popup',
    },
    {
        url: Routes.Privacy,
        component: PrivacySettingsView as unknown as ComponentOptions,
        present: 'popup',
    },
    {
        url: Routes.PaymentAccounts,
        component: PaymentSettingsView as unknown as ComponentOptions,
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
                    if (!platform.value.config.featureFlags.includes('balance-emails')
                        && [EmailTemplateType.UserBalanceIncreaseNotification, EmailTemplateType.UserBalanceReminder].includes(t)) {
                        return false;
                    }

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
        component: RegistrationPaymentSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: RegistrationPageSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        handler: async (options) => {
            const component = buildManageGroupsComponent($organizationManager.value);

            await present({
                ...(options as any),
                components: [component],
            });
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
        component: FreeContributionSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.SingleSignOn,
        present: 'popup',
        component: SSOSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: LabsView as unknown as ComponentOptions,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView as unknown as ComponentOptions,
    },
    {
        url: Routes.BalanceNotifications,
        present: 'popup',
        component: BalanceNotificationSettingsView as unknown as ComponentOptions,
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
const $t = useTranslate();
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
