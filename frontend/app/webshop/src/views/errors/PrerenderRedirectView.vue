<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('024b0957-571c-40c3-954e-a251bd0b257f') }}
            </h1>

            <p>{{ $t('49ee57ef-966d-4496-9e50-2e906788e3fd') }}</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr"><div>
                <aside>
                    <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                        {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$domains.marketing+'/webshops'">{{ $t('09d2ca27-b158-4d48-a36e-76bcbfcd6342') }} <Logo/></a>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Logo, MetaKey, useMetaInfo } from '@stamhoofd/components';

const props = defineProps<{
    location: string;
}>();

useMetaInfo({
    options: {
        key: MetaKey.Routing,
    },
    meta: [
        {
            id: `prerender-status-code`,
            name: 'prerender-status-code',
            content: '301',
        },
        {
            id: `prerender-header-location`,
            name: 'prerender-header',
            content: 'Location: ' + props.location,
        },
        {
            id: `prerender-header-cache`,
            name: 'prerender-header',
            content: 'Cache-Control: no-cache',
        },
    ],
});
</script>
