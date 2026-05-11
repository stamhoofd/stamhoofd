<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Details van jouw pakketten')" />

        <main>
            <h1>{{ $t('Details van jouw pakketten') }}</h1>
            <p>
                <I18nComponent :t="$t('Meer info over alle prijzen en een prijscalculator kan je terugvinden op <button>onze website</button>')">
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
        title: $t('{package-name} deactiveren?', {'package-name': pack.meta.name}),
        description: $t('Je kan dit niet ongedaan maken.'),
        confirmText: $t('Deactiveren'),
        destructive: true,
        requireCheckbox: $t('Ja, ik ben helemaal zeker'),
        availabilityDelay: 1_000,
    })) {
        return;
    }

    await deactivate(pack, $t('Het pakket werd verwijderd'))
}

</script>
