<template>
    <div class="st-view background">
        <STNavigationBar :title="$t(`Webshop archief`)"/>

        <main>
            <h1>
                {{ $t('f8cfe2df-ca47-4975-a904-bea4e238c11c') }}
            </h1>
            <p>{{ $t('4e08ceea-e1cb-4cfa-b0d3-13dc7a0df9f4') }}</p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.id" :selectable="true" @click="openWebshop(webshop)">
                    {{ webshop.meta.name }}

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { LoadComponent, STList, STListItem, STNavigationBar, useOrganization } from '@stamhoofd/components';
import { WebshopPreview, WebshopStatus } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

const organization = useOrganization();
const show = useShow();

const webshops = computed(() => organization.value?.webshops
    .filter(webshop => webshop.meta.status === WebshopStatus.Archived)
    .sort((a, b) => Sorter.byStringValue(a.meta.name, b.meta.name)) ?? []);

async function openWebshop(webshop: WebshopPreview) {
    show({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: await LoadComponent(() => import(/* webpackChunkName: "WebshopOverview" */ './WebshopOverview.vue'), { preview: webshop }, { instant: false }),
            }),
        ] },
    ).catch(console.error);
}
</script>
