<template>
    <div class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.DataPermissions)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
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

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Terms)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg">
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
import { usePatchPlatform } from '@stamhoofd/components/hooks/usePatchPlatform.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { DataPermissionsSettings, Platform, PlatformConfig } from '@stamhoofd/structures';

/**
 * Consent, privacy terms and data retention of the platform together.
 */

enum Routes {
    DataPermissions = 'toestemming-gegevensverzameling',
    Terms = 'voorwaarden',
    DataRetention = 'bewaartermijnen',
}

const title = $t('Privacy en gegevens');
const $navigate = useNavigate();
const platform = usePlatform();
const patchPlatform = usePatchPlatform();

defineRoutes([
    {
        name: Routes.DataPermissions,
        url: Routes.DataPermissions,
        component: async () => (await import('@stamhoofd/components/records/DataPermissionSettingsView.vue')).default,
        defaultProperties() {
            return {
                dataPermission: platform.value.config.dataPermission ?? DataPermissionsSettings.create({}),
                saveHandler: async (patch: AutoEncoderPatchType<DataPermissionsSettings>) => {
                    const isNew = !platform.value.config.dataPermission;
                    await patchPlatform(Platform.patch({
                        config: PlatformConfig.patch({
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
        url: Routes.Terms,
        present: 'popup',
        component: async () => (await import('./privacy/EditPrivacyView.vue')).default,
    },
    {
        url: Routes.DataRetention,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/data-retention/DataRetentionView.vue')).default,
    },
]);
</script>
