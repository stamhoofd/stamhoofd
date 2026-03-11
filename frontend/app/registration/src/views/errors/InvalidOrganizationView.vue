<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                {{ $t('%Dq') }}
            </h1>
            <h1 v-else>
                {{ $t('%DM') }}
            </h1>
            <p>{{ $t('%XB') }}</p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="legal-footer">
                <hr class="style-hr"><div>
                    <aside>
                        <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                            {{ $t('%5X') }}
                        </a>
                    </aside>
                    <div>
                        <a :href="'https://'+$domains.marketing+'/ledenadministratie'">{{ $t('%XC') }} <Logo /></a>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components';

defineProps<{
    errorBox: ErrorBox | null;
}>();
</script>
