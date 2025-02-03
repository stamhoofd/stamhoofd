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
                        {{ $t('017ee92d-62a3-4f64-afec-e2fa7055e97c') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('2a2b9d40-9ccc-4653-84ff-6aa5829434fb') }}
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
                        {{ $t('c0f067fd-3d30-4199-b9da-879a4f011f27') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('28483e7d-2831-4b1a-8321-3c2bc02df268') }}
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
                        {{ $t('1cbf76ca-79d3-4f12-8f09-dc585f5e9da3') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('ef07b66f-6b78-4c47-9599-d8847ea97aaa') }}
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
                        {{ $t('24682ea8-b3c6-4372-9a63-5385520888ff') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('8677fa37-3092-42af-869e-bd7363461d32') }}
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
                        {{ $t('e7ba96d7-b233-45c4-8331-d429fcea40a9') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('e392de09-15a4-4726-8751-074a4d1db650') }}
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
                        {{ $t('429e2447-3506-4828-bb08-a4cde355c78d') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('21683697-3ebf-4f15-827a-ff18d1941f32') }}
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
                        {{ $t('de211760-1306-4108-92e3-9301435d8988') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('70fd0ad1-d005-46ff-9376-50e16d876f4e') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="$feature('event-notifications')" :selectable="true" class="left-center" @click="$navigate(Routes.EventNotificationTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/event-notifications.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('5e2a299f-a166-46a8-9975-cf1b1ce334a6') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('9e53d8ca-d01f-4d64-8707-3877435f28fc') }}
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
                        {{ $t('5d0062df-e595-4e28-b1e3-d399102dfadf') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('76b00f58-a587-431f-9c28-1b86d394fc26') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRecordConfiguration)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/list.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('e6405d38-2bd8-4e24-8e35-24f4daea2a37') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f5bf8b84-52d2-49a3-b4b4-73573b320739') }}
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
                        {{ $t('97201c59-fdcc-48c4-a305-c6b585fddf71') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c5247c05-c8f2-401d-9b77-967e052ef5f7') }}
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
                        {{ $t('b6a7d8fa-58ed-41dd-a2d0-ada96a4e56bb') }}
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
                        {{ $t('2eed292c-1a52-4432-8195-c4ea8a951358') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('a122d0f1-c29d-40de-8700-7506596cdf63') }}
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
                        {{ $t('8ce9e8f6-69a6-4053-a518-015f5189c9b3') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('6ea3e603-3c38-4bd9-a6ec-e135cfbd41d0') }}
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
                        E-mailsjablonen
                    </h2>
                    <p class="style-description">
                        Wijzig de inhoud van automatische en opgeslagen e-mails.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Geavanceerd</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Labs)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/experiment.svg">
                    </template>
                    <h2 class="style-title-list">
                        Experimenten
                    </h2>
                    <p class="style-description">
                        Probeer als eerste nieuwe functies uit die in ontwikkeling zijn.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.loginMethods.has(LoginMethod.SSO)" :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn, { properties: {provider: LoginProviderType.SSO} })">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                    </template>
                    <h2 class="style-title-list">
                        Single-Sign-On (SSO)
                    </h2>
                    <p class="style-description">
                        Configureer een externe authenticatie server
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.loginMethods.has(LoginMethod.Google)" :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn, { properties: {provider: LoginProviderType.Google} })">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/google/google-50.svg">
                    </template>
                    <h2 class="style-title-list">
                        Sign in with Google
                    </h2>
                    <p class="style-description">
                        Configureer login via Google
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
import { AdminsView, DataPermissionSettingsView, EditEmailTemplatesView, EditResponsibilitiesView, EmailSettingsView, FinancialSupportSettingsView, RecordsConfigurationView, SSOSettingsView, Toast, usePlatform } from '@stamhoofd/components';
import { usePlatformManager } from '@stamhoofd/networking';
import { DataPermissionsSettings, FinancialSupportSettings, LoginMethod, LoginProviderType, OrganizationLevelRecordsConfiguration, OrganizationRecordsConfiguration, Platform, PlatformConfig } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import EditCorporateIdView from './corporate-identity/EditCorporateIdView.vue';
import EditDefaultAgeGroupsView from './default-age-groups/EditDefaultAgeGroupsView.vue';
import EditEventNotificationTypesView from './event-notification-types/EditEventNotificationTypesView.vue';
import EditEventTypesView from './event-types/EditEventTypesView.vue';
import EditPremiseTypesView from './event-types/EditPremiseTypesView.vue';
import LabsView from './LabsView.vue';
import EditPlatformMembershipTypesView from './membership-types/EditPlatformMembershipTypesView.vue';
import OrganizationRecordConfigurationView from './organization-records/OrganizationRecordConfigurationView.vue';
import EditPrivacyView from './privacy/EditPrivacyView.vue';
import EditRegistrationPeriodsView from './registration-periods/EditRegistrationPeriodsView.vue';

enum Routes {
    Admins = 'beheerders',
    Records = 'persoonsgegevens',
    DefaultAgeGroups = 'standaard-leeftijdsgroepen',
    Responsibilities = 'functies',
    RegistrationPeriods = 'werkjaren',
    PlatformMembershipTypes = 'lidmaatschappen',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    EventTypes = 'soorten-activiteiten',
    EventNotificationTypes = 'kampmeldingen',
    CorporateIdentity = 'huisstijl',
    Premises = 'lokalen',
    FinancialSupport = 'financiele-ondersteuning',
    DataPermissions = 'toestemming-gegevensverzameling',
    Terms = 'voorwaarden',
    Labs = 'experimenten',
    SingleSignOn = 'sso',
    OrganizationRecordConfiguration = 'organisatie-gegevens',
}

const platform = usePlatform();
const platformManager = usePlatformManager();

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
                            recordsConfiguration: patch,
                        }),
                    }));
                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
    },
    {
        name: Routes.FinancialSupport,
        url: 'financiele-ondersteuning',
        component: FinancialSupportSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                financialSupport: platform.value.config.financialSupport ?? FinancialSupportSettings.create({}),
                saveHandler: async (patch: AutoEncoderPatchType<FinancialSupportSettings>) => {
                    const isNew = !platform.value.config.financialSupport;
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            financialSupport: isNew ? FinancialSupportSettings.create({}).patch(patch) : patch,
                        }),
                    }));
                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
        present: 'popup',
    },
    {
        name: Routes.DataPermissions,
        url: 'toestemming-gegevensverzameling',
        component: DataPermissionSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                dataPermission: platform.value.config.dataPermission ?? DataPermissionsSettings.create({}),
                saveHandler: async (patch: AutoEncoderPatchType<DataPermissionsSettings>) => {
                    const isNew = !platform.value.config.dataPermission;
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            dataPermission: isNew ? DataPermissionsSettings.create({}).patch(patch) : patch,
                        }),
                    }));
                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
        present: 'popup',
    },
    {
        url: Routes.CorporateIdentity,
        present: 'popup',
        component: EditCorporateIdView as ComponentOptions,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: LabsView as ComponentOptions,
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
        url: Routes.EventNotificationTypes,
        present: 'popup',
        component: EditEventNotificationTypesView as ComponentOptions,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: EditPremiseTypesView as ComponentOptions,
    },
    {
        url: Routes.OrganizationRecordConfiguration,
        present: 'popup',
        component: OrganizationRecordConfigurationView as unknown as ComponentOptions,
        paramsToProps() {
            return {
                recordsConfiguration: platform.value.config.organizationLevelRecordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationLevelRecordsConfiguration>) => {
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            organizationLevelRecordsConfiguration: patch,
                        }),
                    }));

                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
    },
    {
        name: Routes.SingleSignOn,
        url: 'sso/@provider',
        present: 'popup',
        params: {
            provider: String,
        },
        component: SSOSettingsView as unknown as ComponentOptions,

        async paramsToProps(params: { provider: string }) {
            const provider = Object.values(LoginProviderType).includes(params.provider as LoginProviderType) ? params.provider as LoginProviderType : null;

            if (!provider) {
                throw new Error('provider not found');
            }

            return {
                provider,
            };
        },
        propsToParams(props) {
            if (!('provider' in props) || typeof props.provider !== 'string') {
                throw new Error('Missing provider');
            }

            return {
                params: {
                    provider: props.provider,
                },
            };
        },
    },
]);
const $navigate = useNavigate();
</script>
