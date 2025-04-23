<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                {{ $t('Deze webshop bestaat niet') }}
            </h1>
            <h1 v-else>
                {{ $t('Er ging iets mis') }}
            </h1>

            <p>{{ $t('Kijk even na of de link klopt of probeer later opnieuw.') }}</p>

            <STErrorsDefault :error-box="errorBox" />

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
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox, Logo, STErrorsDefault } from '@stamhoofd/components';

withDefaults(defineProps<{
    errorBox: ErrorBox | null;
}>(), {
    errorBox: null,
});
</script>
