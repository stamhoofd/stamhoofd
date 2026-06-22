<template>
    <div id="members-settings-view" class="st-view background">
        <STNavigationBar :title="props.period ? props.period.period.name : $t('%Om')">
            <template #right>
                <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                    <span class="icon external" />
                    <span class="hide-small">{{ $t('%2g') }}</span>
                </a>
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                {{ props.period ? props.period.period.name : $t('%1Zz') }}
            </h1>

            <BillingWarningBox filter-types="members" />

            <template v-if="!props.period && !$isPlatform">
                <STInputBox class="max" :title="$t('%On')">
                    <div v-copyable="organization.registerUrl" v-tooltip="$t('%R7')" class="input-with-buttons">
                        <div>
                            <form novalidate class="input-icon-container icon earth small">
                                <input :value="organization.getRegistrationHost()" class="input" readonly="true" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                            </form>
                        </div>
                        <div>
                            <button type="button" class="button text">
                                <span class="icon copy" />
                                <span class="hide-small">{{ $t('%R7') }}</span>
                            </button>
                        </div>
                    </div>
                </STInputBox>
                <p v-if="false" class="style-description-small">
                    <I18nComponent :t="$t('%1be')">
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
                <STListItem v-if="!props.period" :selectable="true" class="left-center" @click="$navigate(Routes.RegistrationPaymentMethods)">
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
                <STListItem v-if="!props.period && !isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRegistrationPeriods)">
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

                <STListItem v-if="!props.period" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationRecords)">
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

                <STListItem v-if="!props.period && !isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.FinancialSupport)">
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

                <STListItem v-if="!props.period && !isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.DataPermissions)">
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

                <STListItem v-if="!props.period" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationFreeContributions)">
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

            <template v-if="!props.period">
                <hr>
                <h2>{{ $t('%16X') }}</h2>

                <STList>
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.MembersImport)">
                        <template #left>
                            <IconContainer icon="upload" />
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%18D') }}
                        </h2>

                        <p class="style-description-small">
                            {{ $t('%18d') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="sgvSyncIsEnabled" :selectable="true" class="left-center" data-testid="sgv-groepsadministratie-button" @click="sgvSyncOpen">
                        <template #left>
                            <IconContainer icon="sync" />
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1aO') }}
                        </h2>

                        <p class="style-description-small">
                            {{ $t('%1Vp') }}
                        </p>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { useSGVSync } from '@stamhoofd/sgv-frontend/useSGVSync';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { DataPermissionsSettings, FinancialSupportSettings, getDataPermissionSettingsOrDefault, getFinancialSupportSettingsOrDefault, Organization, OrganizationMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditGroupsView } from './hooks/useEditGroupsView';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import { useOrganizationRegistrationRecordSettingsRoute } from '@stamhoofd/components/records/useOrganizationRegistrationRecordSettingsRoute.ts';

const Routes = {
    RegistrationPaymentMethods: 'betaalmethodes',
    RegistrationPage: 'pagina',
    RegistrationGroups: 'groepen',
    BundleDiscounts: 'kortingen',
    RegistrationRecords: useOrganizationRegistrationRecordSettingsRoute('persoonsgegevens'),
    RegistrationFreeContributions: 'vrije-bijdrage',
    MembersImport: 'leden-importeren',
    OrganizationRegistrationPeriods: 'werkjaren',
    FinancialSupport: 'financiele-ondersteuning',
    DataPermissions: 'toestemming-gegevensverzameling',
};

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const buildEditGroupsView = useEditGroupsView();
const organization = useRequiredOrganization();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const { sgvSyncOpen, sgvSyncIsEnabled } = useSGVSync();

const props = withDefaults(
    defineProps<{
        period?: OrganizationRegistrationPeriod | null;
    }>(), {
        period: null,
    });

const period = computed(() => props.period ?? organization.value!.period);

defineRoutes([
    {
        url: Routes.RegistrationPaymentMethods,
        present: 'popup',
        component: async () => (await import('./RegistrationPaymentSettingsView.vue')).default,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: async () => (await import('./RegistrationPageSettingsView.vue')).default,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        component: () => {
            return buildEditGroupsView(period.value);
        },
    },
    {
        url: Routes.BundleDiscounts,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/bundle-discounts/BundleDiscountSettingsView.vue')).default,
        defaultProperties() {
            return {
                period: period.value,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = period.value.id;
                    await patchOrganizationPeriod(period.value, patch);
                },
            };
        },
    },
    {
        url: Routes.RegistrationFreeContributions,
        present: 'popup',
        component: async () => (await import('./modules/members/FreeContributionSettingsView.vue')).default,
    },
    {
        url: Routes.MembersImport,
        present: 'popup',
        component: async () => (await import('./modules/members/ImportMembersView.vue')).default,
    },
    ...(!isPlatform
        ? [
                {
                    url: Routes.OrganizationRegistrationPeriods,
                    present: 'popup' as const,
                    component: async () => (await import('@stamhoofd/components/periods/EditRegistrationPeriodsView.vue')).default,
                },
                {
                    name: Routes.FinancialSupport,
                    url: 'financiele-ondersteuning',
                    component: async () => (await import('@stamhoofd/components/records/FinancialSupportSettingsView.vue')).default,
                    defaultProperties() {
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
                    component: async () => (await import('@stamhoofd/components/records/DataPermissionSettingsView.vue')).default,
                    defaultProperties() {
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
