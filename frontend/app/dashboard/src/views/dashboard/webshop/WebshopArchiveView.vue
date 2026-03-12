<template>
    <div class="st-view background">
        <STNavigationBar :title="$t(`%u0`)" />

        <main>
            <h1>
                {{ $t('%u0') }}
            </h1>
            <p>{{ $t('%PT') }}</p>

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
import { LoadComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
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
