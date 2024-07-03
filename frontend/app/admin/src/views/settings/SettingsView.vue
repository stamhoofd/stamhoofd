<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" />

        <main class="center">
            <h1>
                Instellingen
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Admins)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
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

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.MembershipTypes)">
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
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ComponentOptions } from 'vue';
import {AdminsView, RecordsConfigurationView, Toast, usePlatform} from '@stamhoofd/components';
import { OrganizationRecordsConfiguration, Platform, PlatformConfig } from '@stamhoofd/structures'
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePlatformManager } from '@stamhoofd/networking';
import EditDefaultAgeGroupsView from './default-age-groups/EditDefaultAgeGroupsView.vue';
import EditMemberResponsibilitiesView from './responsibilities/EditMemberResponsibilitiesView.vue';
import EditRegistrationPeriodsView from './registration-periods/EditRegistrationPeriodsView.vue';
import EditMembershipTypesView from './membership-types/EditMembershipTypesView.vue';

enum Routes {
    Admins = 'beheerders',
    Records = 'records',
    DefaultAgeGroups = 'standaard-leeftijdsgroepen',
    Responsibilities = 'functies',
    RegistrationPeriods = 'werkjaren',
    MembershipTypes = 'lidmaatschappen',
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
        url: Routes.DefaultAgeGroups,
        present: 'popup',
        component: EditDefaultAgeGroupsView as ComponentOptions,
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditMemberResponsibilitiesView as ComponentOptions,
    },
    {
        url: Routes.RegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView as ComponentOptions,
    },
    {
        url: Routes.MembershipTypes,
        present: 'popup',
        component: EditMembershipTypesView as ComponentOptions,
    }
])
const $navigate = useNavigate()
</script>
