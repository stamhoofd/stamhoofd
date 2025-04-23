<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                {{ $t('8b54b2c4-e7bb-4efe-8e7e-a02a2fa6667e') }}
            </h1>
            <h1 v-else>
                {{ $t('44e0c667-07c5-4ff9-8bf2-623d9aa91219') }}
            </h1>

            <p>{{ $t('9c2198f2-9234-42e8-8783-3684d37a513e') }}</p>

            <STErrorsDefault :error-box="errorBox" />

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
