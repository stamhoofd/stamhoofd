<template>
    <div class="st-view background">
        <STNavigationBar title="Webshop archief" />

        <main>
            <h1>
                Webshop archief
            </h1>
            <p>Deze webshops werden gearchiveerd en zijn niet langer actief.</p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.id" :selectable="true" @click="openWebshop(webshop)">
                    {{ webshop.meta.name }}

                    <template #right>
                        <span class="icon arrow-right-small gray" />
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
