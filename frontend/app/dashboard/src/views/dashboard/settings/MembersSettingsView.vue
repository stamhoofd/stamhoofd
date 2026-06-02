<template>
    <div id="members-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Leden`)">
            <template #right>
                <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                    <span class="icon external" />
                    <span class="hide-small">{{ $t('Ledenportaal') }}</span>
                </a>
            </template>
        </STNavigationBar>

        <main class="center force">
            <h1>
                {{ $t('Ledenadministratie instellingen') }}
            </h1>

            <BillingWarningBox filter-types="members" />

            <template v-if="!$isPlatform">
                <STInputBox class="max" :title="$t('Link naar ledenportaal')">
                    <div v-copyable="organization.registerUrl" v-tooltip="$t('Kopiëren')" class="input-with-buttons">
                        <div>
                            <form novalidate class="input-icon-container icon earth small">
                                <input :value="organization.getRegistrationHost()" class="input" readonly="true" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                            </form>
                        </div>
                        <div>
                            <button type="button" class="button text">
                                <span class="icon copy" />
                                <span class="hide-small">{{ $t('Kopiëren') }}</span>
                            </button>
                        </div>
                    </div>
                </STInputBox>
                <p v-if="false" class="style-description-small">
                    <I18nComponent :t="$t('Plaats een knop naar deze link op je website en deel het op je sociale media. Je kan het <button>hier</button> personaliseren.')">
                        <template #button="{content}">
                            <button type="button" class="inline-link" @click="$navigate(Routes.RegistrationPage)">
                                {{ content }}
                            </button>
                        </template>
                    </I18nComponent>
                </p>
                <hr>
            </template>

            <STList class="illustration-list">
                <STListItem v-if="!isPlatform && false" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%On') }}
                    </h2>
                    <p class="style-description-small">
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
                    <p class="style-description-small">
                        {{ $t('%2p') }}
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
                    <p class="style-description-small">
                        {{ $t('%3e') }}
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
                    <p class="style-description-small">
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
                    <p class="style-description-small">
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
                    <p class="style-description-small">
                        {{ $t('%Os') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.FinancialSupport)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ platform.config.financialSupport?.title || FinancialSupportSettings.defaultTitle }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Te') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.DataPermissions)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%vY') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%5j') }}
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
                    <p class="style-description-small">
                        {{ $t('%Ou') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('Acties') }}</h2>

            <STList>
                <STListItem v-if="!$isPlatform" v-copyable="organization.registerUrl" :selectable="true" class="left-center">
                    <template #left>
                        <IconContainer icon="link" />
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%az') }}
                    </h2>
                    <div class="option">
                        <input class="input" :value="organization.registerUrl" readonly>
                    </div>
                </STListItem>

                <STListItem v-copyable="organization.registerUrl" :selectable="true" class="left-center" @click="$navigate(Routes.MembersImport)">
                    <template #left>
                        <IconContainer icon="upload" />
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Leden importeren') }}
                    </h2>

                    <p class="style-description-small">
                        {{ $t('%18d') }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import BundleDiscountSettingsView from '@stamhoofd/components/bundle-discounts/BundleDiscountSettingsView.vue';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import EditRegistrationPeriodsView from '@stamhoofd/components/periods/EditRegistrationPeriodsView.vue';
import RecordsConfigurationView from '@stamhoofd/components/records/RecordsConfigurationView.vue';

import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { DataPermissionSettingsView, FinancialSupportSettingsView } from '@stamhoofd/components';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { DataPermissionsSettings, FinancialSupportSettings, getDataPermissionSettingsOrDefault, getFinancialSupportSettingsOrDefault, Organization, OrganizationMetaData, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import RegistrationPageSettingsView from './RegistrationPageSettingsView.vue';
import RegistrationPaymentSettingsView from './RegistrationPaymentSettingsView.vue';
import { useEditGroupsView } from './hooks/useEditGroupsView';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import ImportMembersView from './modules/members/ImportMembersView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';

enum Routes {
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
    Packages = 'functionaliteiten',
    PaymentSettings = 'betalingen',
    Referrals = 'referrals',
    Labs = 'experimenten',
    Premises = 'lokalen',
    BalanceNotifications = 'openstaande-bedragen-notificaties',
    MembersImport = 'leden-importeren',
    Uitpas = 'uitpas',
    OrganizationRegistrationPeriods = 'werkjaren',
    FinancialSupport = 'financiele-ondersteuning',
    DataPermissions = 'toestemming-gegevensverzameling',
    Invoices = 'uitgaande-facturen',
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();
const buildEditGroupsView = useEditGroupsView();
const organization = useRequiredOrganization();
const patchOrganizationPeriod = usePatchOrganizationPeriod();

defineRoutes([
    {
        url: Routes.RegistrationPaymentMethods,
        present: 'popup',
        component: RegistrationPaymentSettingsView,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: () => RegistrationPageSettingsView,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        handler: async (options) => {
            const component = await buildEditGroupsView();

            await present({
                ...options,
                components: [component],
            });
        },
    },
    {
        url: Routes.BundleDiscounts,
        present: 'popup',
        component: BundleDiscountSettingsView,
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
        component: RecordsConfigurationView,
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
        component: () => FreeContributionSettingsView,
    },
    {
        url: Routes.MembersImport,
        present: 'popup',
        component: ImportMembersView,
    },
    {
        url: Routes.OrganizationRegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView,
    },
    ...(!isPlatform
        ? [
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

</script>
