<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('%Y1') }}
            </h1>

            <p>{{ $t('%Y2') }}</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr"><div>
                <aside>
                    <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                        {{ $t('%5X') }}
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$domains.marketing+'/webshops'">{{ $t('%1b') }} <Logo /></a>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import Logo from '@stamhoofd/components/icons/Logo.vue';
import { MetaKey, useMetaInfo } from '@stamhoofd/components/helpers/useMetaInfo.ts';

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
