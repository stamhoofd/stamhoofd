<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" />

        <main class="center">
            <h1>
                Instellingen
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.CorporateIdentity)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Huisstijl') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Stel de kleuren en huisstijl in van het platform') }}
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
                        {{ $t('admin.settings.admins.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.admins.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.RegistrationPeriods)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/calendar.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.registrationPeriods.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.registrationPeriods.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>


                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.DefaultAgeGroups)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.defaultAgeGroups.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.defaultAgeGroups.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/responsibility.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.responsibilities.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.responsibilities.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PlatformMembershipTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/membership.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.membershipTypes.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.membershipTypes.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EventTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/tent.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Soorten activiteiten') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Stel in welke soorten activiteiten er bestaan en toegevoegd kunnen worden aan de kalender') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Premises)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/house.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Soorten gebouwen') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Stel in welke soorten gebouwen groepen kunnen toevoegen') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Gegevensverzameling</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Records)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/health-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.records.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.records.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.FinancialSupport)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ platform.config.financialSupport?.title || FinancialSupportSettings.defaultTitle }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Wijzig de instellingen rond financiële ondersteuning') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.DataPermissions)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Toestemming gegevensverzameling') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Wijzig de instellingen rond toestemming voor gegevensverzameling') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Terms)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Privacyvoorwaarden en andere overeenkomsten') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Wijzig de privacyvoorwaarden') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>E-mails</h2>

            <STList class="illustration-list">  
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        E-mailadressen
                    </h2>
                    <p class="style-description">
                        Wijzig de e-mailadressen waaruit e-mails verzonden kunnen worden.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailTemplates)">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/email-template.svg">
                    </template>
                    <h2 class="style-title-list">
                        Automatische e-mails
                    </h2>
                    <p class="style-description">
                        Wijzig de inhoud van (automatische) e-mails.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { AdminsView, DataPermissionSettingsView, EditEmailTemplatesView, EditResponsibilitiesView, EmailSettingsView, FinancialSupportSettingsView, RecordsConfigurationView, Toast, usePlatform } from '@stamhoofd/components';
import { usePlatformManager } from '@stamhoofd/networking';
import { DataPermissionsSettings, FinancialSupportSettings, OrganizationRecordsConfiguration, Platform, PlatformConfig } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import EditCorporateIdView from './corporate-identity/EditCorporateIdView.vue';
import EditDefaultAgeGroupsView from './default-age-groups/EditDefaultAgeGroupsView.vue';
import EditEventTypesView from './event-types/EditEventTypesView.vue';
import EditPremiseTypesView from './event-types/EditPremiseTypesView.vue';
import EditPlatformMembershipTypesView from './membership-types/EditPlatformMembershipTypesView.vue';
import EditRegistrationPeriodsView from './registration-periods/EditRegistrationPeriodsView.vue';
import EditPrivacyView from './privacy/EditPrivacyView.vue';

enum Routes {
    Admins = 'beheerders',
    Records = 'vragenlijsten',
    DefaultAgeGroups = 'standaard-leeftijdsgroepen',
    Responsibilities = 'functies',
    RegistrationPeriods = 'werkjaren',
    PlatformMembershipTypes = 'lidmaatschappen',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    EventTypes = 'soorten-activiteiten',
    CorporateIdentity = 'huisstijl',
    Premises = 'gebouwen',
    FinancialSupport = 'financiele-ondersteuning',
    DataPermissions = 'toestemming-gegevensverzameling',
    Terms = 'voorwaarden'
}

const platform = usePlatform()
const platformManager = usePlatformManager()

defineRoutes([
    {
        url: Routes.Admins,
        component: AdminsView as ComponentOptions,
    },
    {
        url: Routes.Records,
        present: 'popup',
        component: RecordsConfigurationView as ComponentOptions,
        paramsToProps() {
            return {
                recordsConfiguration: platform.value.config.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            recordsConfiguration: patch
                        })
                    }))
                    Toast.success("De aanpassingen zijn opgeslagen").show();
                }
            }
        }
    },
    {
        name: Routes.FinancialSupport,
        url: 'financiele-ondersteuning',
        component: FinancialSupportSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                financialSupport: platform.value.config.financialSupport ?? FinancialSupportSettings.create({}),
                saveHandler: async (patch: AutoEncoderPatchType<FinancialSupportSettings>) => {
                    const isNew = !platform.value.config.financialSupport
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            financialSupport: isNew ? FinancialSupportSettings.create({}).patch(patch) : patch
                        })
                    }))
                    Toast.success("De aanpassingen zijn opgeslagen").show();
                }
            }
        },
        present: 'popup'
    },
    {
        name: Routes.DataPermissions,
        url: 'toestemming-gegevensverzameling',
        component: DataPermissionSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                dataPermission: platform.value.config.dataPermission ?? DataPermissionsSettings.create({}),
                saveHandler: async (patch: AutoEncoderPatchType<DataPermissionsSettings>) => {
                    const isNew = !platform.value.config.dataPermission
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            dataPermission: isNew ? DataPermissionsSettings.create({}).patch(patch) : patch
                        })
                    }))
                    Toast.success("De aanpassingen zijn opgeslagen").show();
                }
            }
        },
        present: 'popup'
    },
    {
        url: Routes.CorporateIdentity,
        present: 'popup',
        component: EditCorporateIdView as ComponentOptions,
    },
    {
        url: Routes.DefaultAgeGroups,
        present: 'popup',
        component: EditDefaultAgeGroupsView as ComponentOptions,
    },
    {
        url: Routes.Terms,
        present: 'popup',
        component: EditPrivacyView as ComponentOptions,
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditResponsibilitiesView as ComponentOptions,
    },
    {
        url: Routes.RegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView as ComponentOptions,
    },
    {
        url: Routes.PlatformMembershipTypes,
        present: 'popup',
        component: EditPlatformMembershipTypesView as ComponentOptions,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: EditEmailTemplatesView as ComponentOptions,
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: EmailSettingsView as ComponentOptions,
    },
    {
        url: Routes.EventTypes,
        present: 'popup',
        component: EditEventTypesView as ComponentOptions,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: EditPremiseTypesView as ComponentOptions,
    }
])
const $navigate = useNavigate()
</script>
