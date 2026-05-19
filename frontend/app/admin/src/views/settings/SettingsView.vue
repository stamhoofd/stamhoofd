<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`%xU`)" />

        <main class="center">
            <h1>
                {{ $t("%xU") }}
            </h1>

            <STList class="illustration-list">
                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.CorporateIdentity)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/palette.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%5d") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%5e") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.Admins)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/admin.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%3K") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%3J") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.RegistrationPeriods)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/calendar.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%3i") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%3e") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    v-for="item in usedSettingItems"
                    :key="item.route"
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(item.route)"
                >
                    <template #left>
                        <img :src="item.image">
                    </template>
                    <h2 class="style-title-list">
                        {{ item.title }}
                    </h2>
                    <p class="style-description-small">
                        {{ item.description }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t("%HL") }}</h2>

            <STList class="illustration-list">
                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.Records)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/health-data.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%Or") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%3b") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.FinancialSupport)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/discount.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{
                            platform.config.financialSupport?.title ||
                                FinancialSupportSettings.defaultTitle
                        }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%5i") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.DataPermissions)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/agreement.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%vY") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%5j") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.Terms)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/privacy-policy.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%5k") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%5l") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t("%HM") }}</h2>

            <STList class="illustration-list">
                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.EmailSettings)"
                >
                    <template #left>
                        <img
                            src="~@stamhoofd/assets/images/illustrations/email.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%1EJ") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%HN") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.EmailTemplates)"
                >
                    <template #left>
                        <img
                            src="~@stamhoofd/assets/images/illustrations/email-template.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%1DD") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%HO") }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="unusedSettingItems.length > 0">
                <hr>
                <h2>{{ $t("%HP") }}</h2>

                <STList class="illustration-list">
                    <STListItem
                        v-for="item in unusedSettingItems"
                        :key="item.route"
                        :selectable="true"
                        class="left-center"
                        @click="$navigate(item.route)"
                    >
                        <template #left>
                            <img :src="item.image">
                        </template>
                        <h2 class="style-title-list">
                            {{ item.title }}
                        </h2>
                        <p class="style-description-small">
                            {{ item.description }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <hr>
            <h2>{{ $t("%HQ") }}</h2>

            <STList class="illustration-list">
                <STListItem
                    :selectable="true"
                    class="left-center"
                    @click="$navigate(Routes.Labs)"
                >
                    <template #left>
                        <img
                            src="@stamhoofd/assets/images/illustrations/experiment.svg"
                        >
                    </template>
                    <h2 class="style-title-list">
                        {{ $t("%HD") }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t("%HR") }}
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
import { defineRoute, defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import eventNotificationsIllustration from '@stamhoofd/assets/images/illustrations/event-notifications.svg';
import groupIllustration from '@stamhoofd/assets/images/illustrations/group.svg';
import houseIllustration from '@stamhoofd/assets/images/illustrations/house.svg';
import listIllustration from '@stamhoofd/assets/images/illustrations/list.svg';
import membershipIllustration from '@stamhoofd/assets/images/illustrations/membership.svg';
import tentIllustration from '@stamhoofd/assets/images/illustrations/tent.svg';

import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';

import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag';

import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import type {
    OrganizationLevelRecordsConfiguration,
    OrganizationRecordsConfiguration,
} from '@stamhoofd/structures';
import {
    DataPermissionsSettings,
    FinancialSupportSettings,
    LoginProviderType,
    Platform,
    PlatformConfig,
} from '@stamhoofd/structures';
import { computed } from 'vue';


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
    OrganizationRecordConfiguration = 'organisatie-gegevens',
    SingleSignOn = 'SingleSignOn',
}

const platform = usePlatform();
const platformManager = usePlatformManager();
const $feature = useFeatureFlag();

const settingItems = computed(() => [
    {
        route: Routes.DefaultAgeGroups,
        image: groupIllustration,
        title: $t('%3M'),
        description: $t('%3L'),
        visible: true,
        used: platform.value.config.defaultAgeGroups.length > 0,
    },
    {
        route: Routes.PlatformMembershipTypes,
        image: membershipIllustration,
        title: $t('%3a'),
        description: $t('%3P'),
        visible: true,
        used: platform.value.config.membershipTypes.length > 0,
    },
    {
        route: Routes.EventTypes,
        image: tentIllustration,
        title: $t('%8h'),
        description: $t('%5f'),
        visible: !$feature('disable-events'),
        used: platform.value.config.eventTypes.length > 0,
    },
    {
        route: Routes.EventNotificationTypes,
        image: eventNotificationsIllustration,
        title: $t('%CV'),
        description: $t('%8c'),
        visible: !$feature('disable-events') && $feature('event-notifications'),
        used: platform.value.config.eventNotificationTypes.length > 0,
    },
    {
        route: Routes.Premises,
        image: houseIllustration,
        title: $t('%5g'),
        description: $t('%5h'),
        visible: true,
        used: platform.value.config.premiseTypes.length > 0,
    },
    {
        route: Routes.OrganizationRecordConfiguration,
        image: listIllustration,
        title: $t('%89'),
        description: $t('%8A'),
        visible: true,
        used:
            platform.value.config.organizationLevelRecordsConfiguration
                .recordCategories.length > 0,
    },
]);
const usedSettingItems = computed(() =>
    settingItems.value.filter(item => item.visible && item.used),
);
const unusedSettingItems = computed(() =>
    settingItems.value.filter(item => item.visible && !item.used),
);

defineRoutes([
    {
        url: Routes.Admins,
        component: async () => (await import('@stamhoofd/components/admins/AdminsView.vue')).default,
    },
    {
        url: Routes.Records,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/records/RecordsConfigurationView.vue')).default,
        defaultProperties() {
            return {
                recordsConfiguration:
                    platform.value.config.recordsConfiguration,
                saveHandler: async (
                    patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>,
                ) => {
                    await platformManager.value.patch(
                        Platform.patch({
                            config: PlatformConfig.patch({
                                recordsConfiguration: patch,
                            }),
                        }),
                    );
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
    },
    {
        name: Routes.FinancialSupport,
        url: 'financiele-ondersteuning',
        component: async () => (await import('@stamhoofd/components/records/FinancialSupportSettingsView.vue')).default,
        defaultProperties() {
            return {
                financialSupport:
                    platform.value.config.financialSupport
                    ?? FinancialSupportSettings.create({}),
                saveHandler: async (
                    patch: AutoEncoderPatchType<FinancialSupportSettings>,
                ) => {
                    const isNew = !platform.value.config.financialSupport;
                    await platformManager.value.patch(
                        Platform.patch({
                            config: PlatformConfig.patch({
                                financialSupport: isNew
                                    ? FinancialSupportSettings.create({}).patch(
                                            patch,
                                        )
                                    : patch,
                            }),
                        }),
                    );
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
        present: 'popup',
    },
    {
        name: Routes.DataPermissions,
        url: 'toestemming-gegevensverzameling',
        component: async () => (await import('@stamhoofd/components/records/DataPermissionSettingsView.vue')).default,
        defaultProperties() {
            return {
                dataPermission:
                    platform.value.config.dataPermission
                    ?? DataPermissionsSettings.create({}),
                saveHandler: async (
                    patch: AutoEncoderPatchType<DataPermissionsSettings>,
                ) => {
                    const isNew = !platform.value.config.dataPermission;
                    await platformManager.value.patch(
                        Platform.patch({
                            config: PlatformConfig.patch({
                                dataPermission: isNew
                                    ? DataPermissionsSettings.create({}).patch(
                                            patch,
                                        )
                                    : patch,
                            }),
                        }),
                    );
                    Toast.success($t(`%HU`)).show();
                },
            };
        },
        present: 'popup',
    },
    {
        url: Routes.CorporateIdentity,
        present: 'popup',
        component: async () => (await import('./corporate-identity/EditCorporateIdView.vue')).default,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: async () => (await import('./LabsView.vue')).default,
    },
    {
        url: Routes.DefaultAgeGroups,
        present: 'popup',
        component: async () => (await import('./default-age-groups/EditDefaultAgeGroupsView.vue')).default,
    },
    {
        url: Routes.Terms,
        present: 'popup',
        component: async () => (await import('./privacy/EditPrivacyView.vue')).default,
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/responsibilities/EditResponsibilitiesView.vue')).default,
    },
    {
        url: Routes.RegistrationPeriods,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/periods/EditRegistrationPeriodsView.vue')).default,
    },
    {
        url: Routes.PlatformMembershipTypes,
        present: 'popup',
        component: async () => (await import('./membership-types/EditPlatformMembershipTypesView.vue')).default,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/email/EditEmailTemplatesView.vue')).default,
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/email/EmailSettingsView.vue')).default,
    },
    {
        url: Routes.EventTypes,
        present: 'popup',
        component: async () => (await import('./event-types/EditEventTypesView.vue')).default,
    },
    {
        url: Routes.EventNotificationTypes,
        present: 'popup',
        component: async () => (await import('./event-notification-types/EditEventNotificationTypesView.vue')).default,
    },
    {
        url: Routes.Premises,
        present: 'popup',
        component: async () => (await import('./event-types/EditPremiseTypesView.vue')).default,
    },
    {
        url: Routes.OrganizationRecordConfiguration,
        present: 'popup',
        component: async () => (await import('./organization-records/OrganizationRecordConfigurationView.vue')).default,
        defaultProperties() {
            return {
                recordsConfiguration:
                    platform.value.config.organizationLevelRecordsConfiguration,
                saveHandler: async (
                    patch: AutoEncoderPatchType<OrganizationLevelRecordsConfiguration>,
                ) => {
                    await platformManager.value.patch(
                        Platform.patch({
                            config: PlatformConfig.patch({
                                organizationLevelRecordsConfiguration: patch,
                            }),
                        }),
                    );

                    Toast.success($t(`%HU`)).show();
                },
            };
        },
    },
]);

defineRoute({
    name: Routes.SingleSignOn,
    url: 'sso/@provider',
    present: 'popup',
    params: {
        provider: String,
    },
    component: async () => (await import('@stamhoofd/components/auth/SSOSettingsView.vue')).default,

    async paramsToProps(params) {
        const provider = Object.values(LoginProviderType).includes(params.provider as LoginProviderType) ? params.provider as LoginProviderType : null;

        if (!provider) {
            throw new Error('provider not found');
        }

        return {
            provider,
        };
    },
    propsToParams(props) {
        return {
            params: {
                provider: props.provider,
            },
        };
    },
});

const $navigate = useNavigate();
</script>
