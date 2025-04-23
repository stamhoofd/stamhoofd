<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('Doorverwijzen...') }}
            </h1>

            <p>{{ $t('Bezig met doorverwijzen') }}</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr"><div>
                <aside>
                    <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                        {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$domains.marketing+'/webshops'">{{ $t('Webshop via') }} <Logo /></a>
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
