<template>
    <div class="st-view">
        <STNavigationBar :title="$t('%1Sb')" />

        <main>
            <h1>{{ $t('%1Sb') }}</h1>
            <p>
                <I18nComponent :t="$t('%1Sr')">
                    <template #button="{content}">
                        <a :href="'https://'+ LocalizedDomains.marketing +'/prijzen'" class="inline-link" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <STList>
                <STPackageRow v-for="pack of sorted" :key="pack.id" :pack="pack">
                    <template v-if="pack.meta.canDeactivate" #right>
                        <LoadingButton :loading="isDeactivatingPackage && isDeactivatingPackage.id === pack.id">
                            <button type="button" class="button icon trash" @click="deactivatePackage(pack)" />
                        </LoadingButton>
                    </template>
                </STPackageRow>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import type { STPackage } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { useDeactivatePackage } from './hooks/useDeactivatePackage';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';

const props = defineProps<{
    packages: STPackage[];
}>();

const sorted = props.packages.slice().sort((a, b) => -Sorter.byDateValue(a.meta.startDate, b.meta.startDate))
const {isDeactivatingPackage, deactivate} = useDeactivatePackage();

async function deactivatePackage(pack: STPackage) {
    if (!await CenteredMessage.confirm({
        title: $t('%1Th', {'package-name': pack.meta.name}),
        description: $t('%1Fc'),
        confirmText: $t('%1Sa'),
        destructive: true,
        requireCheckbox: $t('%1Q0'),
        availabilityDelay: 1_000,
    })) {
        return;
    }

    await deactivate(pack, $t('%1Rk'))
}

</script>
