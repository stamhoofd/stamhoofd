<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`%xU`)" />

        <main class="center">
            <h1>
                {{ $t('%xU') }}
            </h1>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.CorporateIdentity)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%5d') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5e') }}
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
                        {{ $t('%3K') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3J') }}
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
                        {{ $t('%3i') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3e') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.defaultAgeGroups.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.DefaultAgeGroups)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3M') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3L') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.membershipTypes.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.PlatformMembershipTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/membership.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3a') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3P') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!$feature('disable-events') && platform.config.eventTypes.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.EventTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/tent.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%8h') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5f') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!$feature('disable-events') && $feature('event-notifications') && platform.config.eventNotificationTypes.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.EventNotificationTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/event-notifications.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%CV') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%8c') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.premiseTypes.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.Premises)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/house.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%5g') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5h') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.organizationLevelRecordsConfiguration.recordCategories.length > 0" :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRecordConfiguration)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/list.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%89') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%8A') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%HL') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Records)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/health-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%Or') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3b') }}
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
                        {{ $t('%5i') }}
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
                        {{ $t('%vY') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5j') }}
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
                        {{ $t('%5k') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5l') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%HM') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1EJ') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%HN') }}
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
                        {{ $t('%1DD') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%HO') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%HP') }}</h2>

            <STList class="illustration-list">
                <STListItem v-if="platform.config.defaultAgeGroups.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.DefaultAgeGroups)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3M') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3L') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.membershipTypes.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.PlatformMembershipTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/membership.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3a') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3P') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!$feature('disable-events') && platform.config.eventTypes.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.EventTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/tent.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%8h') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5f') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!$feature('disable-events') && $feature('event-notifications') && platform.config.eventNotificationTypes.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.EventNotificationTypes)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/event-notifications.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%CV') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%8c') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.premiseTypes.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.Premises)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/house.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%5g') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%5h') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="platform.config.organizationLevelRecordsConfiguration.recordCategories.length === 0" :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRecordConfiguration)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/list.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%89') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%8A') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%HQ') }}</h2>

            <STList class="illustration-list">
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

                <STListItem v-if="platform.config.loginMethods.has(LoginMethod.SSO)" :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn, { properties: {provider: LoginProviderType.SSO} })">
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

                <STListItem v-if="platform.config.loginMethods.has(LoginMethod.Google)" :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn, { properties: {provider: LoginProviderType.Google} })">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/google/google-50.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%12') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%HT') }}
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
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import AdminsView from '@stamhoofd/components/admins/AdminsView.vue';
import DataPermissionSettingsView from '@stamhoofd/components/records/DataPermissionSettingsView.vue';
import EditEmailTemplatesView from '@stamhoofd/components/email/EditEmailTemplatesView.vue';
import EditRegistrationPeriodsView from '@stamhoofd/components/periods/EditRegistrationPeriodsView.vue';
import EditResponsibilitiesView from '@stamhoofd/components/responsibilities/EditResponsibilitiesView.vue';
import EmailSettingsView from '@stamhoofd/components/email/EmailSettingsView.vue';
import FinancialSupportSettingsView from '@stamhoofd/components/records/FinancialSupportSettingsView.vue';
import RecordsConfigurationView from '@stamhoofd/components/records/RecordsConfigurationView.vue';
import SSOSettingsView from '@stamhoofd/components/auth/SSOSettingsView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import type { OrganizationLevelRecordsConfiguration, OrganizationRecordsConfiguration} from '@stamhoofd/structures';
import { DataPermissionsSettings, FinancialSupportSettings, LoginMethod, LoginProviderType, Platform, PlatformConfig } from '@stamhoofd/structures';
import EditCorporateIdView from './corporate-identity/EditCorporateIdView.vue';
import EditDefaultAgeGroupsView from './default-age-groups/EditDefaultAgeGroupsView.vue';
import EditEventNotificationTypesView from './event-notification-types/EditEventNotificationTypesView.vue';
import EditEventTypesView from './event-types/EditEventTypesView.vue';
import EditPremiseTypesView from './event-types/EditPremiseTypesView.vue';
import LabsView from './LabsView.vue';
import EditPlatformMembershipTypesView from './membership-types/EditPlatformMembershipTypesView.vue';
import OrganizationRecordConfigurationView from './organization-records/OrganizationRecordConfigurationView.vue';
import EditPrivacyView from './privacy/EditPrivacyView.vue';

// todo translations
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
        component: AdminsView,
    },
    {
        url: Routes.Records,
        present: 'popup',
        component: RecordsConfigurationView,
        paramsToProps() {
            return {
                recordsConfiguration: platform.value.config.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            recordsConfiguration: patch,
                        }),
                    }));
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
    },
    {
        name: Routes.FinancialSupport,
        url: 'financiele-ondersteuning',
        component: FinancialSupportSettingsView,
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
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
        present: 'popup',
    },
    {
        name: Routes.DataPermissions,
        url: 'toestemming-gegevensverzameling',
        component: DataPermissionSettingsView,
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
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
        present: 'popup',
    },
    {
        url: Routes.CorporateIdentity,
        present: 'popup',
        component: EditCorporateIdView,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: LabsView,
    },
    {
        url: Routes.DefaultAgeGroups,
        present: 'popup',
        component: EditDefaultAgeGroupsView,
    },
    {
        url: Routes.Terms,
        present: 'popup',
        component: EditPrivacyView,
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditResponsibilitiesView,
    },
    {
        url: Routes.RegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView,
    },
    {
        url: Routes.PlatformMembershipTypes,
        present: 'popup',
        component: EditPlatformMembershipTypesView,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: EditEmailTemplatesView,
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: EmailSettingsView,
    },
    {
        url: Routes.EventTypes,
        present: 'popup',
        component: EditEventTypesView,
    },
    {
        url: Routes.EventNotificationTypes,
        present: 'popup',
        component: EditEventNotificationTypesView,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: EditPremiseTypesView,
    },
    {
        url: Routes.OrganizationRecordConfiguration,
        present: 'popup',
        component: OrganizationRecordConfigurationView,
        paramsToProps() {
            return {
                recordsConfiguration: platform.value.config.organizationLevelRecordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationLevelRecordsConfiguration>) => {
                    await platformManager.value.patch(Platform.patch({
                        config: PlatformConfig.patch({
                            organizationLevelRecordsConfiguration: patch,
                        }),
                    }));

                    Toast.success($t(`%HU`)).show();
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
        component: SSOSettingsView,

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
