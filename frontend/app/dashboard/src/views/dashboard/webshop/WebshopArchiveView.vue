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
import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { WebshopPreview } from '@stamhoofd/structures';
import { WebshopStatus } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

const organization = useOrganization();
const $navigate = useNavigate();

const webshops = computed(() => organization.value?.webshops
    .filter(webshop => webshop.meta.status === WebshopStatus.Archived)
    .sort((a, b) => Sorter.byStringValue(a.meta.name, b.meta.name)) ?? []);

enum Routes {
    Webshop = 'webshop',
}

async function openWebshop(webshop: WebshopPreview) {
    await $navigate(Routes.Webshop, { properties: { preview: webshop } });
}

defineRoute({
    url: '@slug',
    name: Routes.Webshop,
    params: {
        slug: String,
    },
    component: async () =>
        (await import(/* webpackChunkName: "WebshopOverview" */ './WebshopOverview.vue')).default,
    paramsToProps: ({ slug }) => {
        const webshop = webshops.value.find(
            shop => Formatter.slug(shop.id) === slug,
        );

        if (!webshop) {
            throw new Error('Webshop not found');
        }

        return {
            preview: webshop,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.preview.id),
            },
        };
    },
},
);
</script>
