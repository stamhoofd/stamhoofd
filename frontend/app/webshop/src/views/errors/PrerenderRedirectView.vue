<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('12d2a8ca-d23d-4238-ba3d-86cd31a48067') }}
            </h1>

            <p>{{ $t('a0b2d272-5bcf-4ecb-9bb1-f2ba239b6c03') }}</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr"><div>
                <aside>
                    <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                        {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$domains.marketing+'/webshops'">{{ $t('9c3179f1-549a-4f72-975b-96b1baf0f239') }} <Logo /></a>
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
