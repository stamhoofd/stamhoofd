<template>
    <div class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Privacy)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%Oj') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ok') }}
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
                    <p class="style-description-small">
                        {{ $t('%5j') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" data-testid="open-data-retention-settings" @click="$navigate(Routes.DataRetention)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Bewaartermijnen') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('Kies hoe lang gegevens bewaard blijven') }}
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
import type { AutoEncoderPatchType } from '@common/encoding';
import { defineRoutes, useNavigate } from '@browser/navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganizationManager } from '@stamhoofd/frontend-application/OrganizationManager';
import { DataPermissionsSettings, getDataPermissionSettingsOrDefault, Organization, OrganizationMetaData } from '@stamhoofd/structures';

/**
 * Privacy terms, consent and data retention together, for an organization without a platform.
 * Within a platform only data retention remains, so the settings open that directly.
 */

enum Routes {
    Privacy = 'privacyvoorwaarden',
    DataPermissions = 'toestemming-gegevensverzameling',
    DataRetention = 'bewaartermijnen',
}

const title = $t('Privacy en gegevens');
const $navigate = useNavigate();
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const organization = useRequiredOrganization();

defineRoutes([
    {
        url: Routes.Privacy,
        component: async () => (await import('./PrivacySettingsView.vue')).default,
        present: 'popup',
    },
    {
        name: Routes.DataPermissions,
        url: Routes.DataPermissions,
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
                    Toast.success($t('%HU')).show();
                },
            };
        },
        present: 'popup',
    },
    {
        url: Routes.DataRetention,
        component: async () => (await import('@stamhoofd/components/data-retention/DataRetentionView.vue')).default,
        present: 'popup',
    },
]);
</script>
