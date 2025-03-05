<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                {{ $t('394637c6-0c85-475c-98ca-fb0e7578427b') }}
            </h1>
            <h1 v-else>
                {{ $t('c6f110e7-e7e4-4119-b121-754fea76fd68') }}
            </h1>
            <p>{{ $t('f4255d17-9da2-4487-9f3d-92202d639b79') }}</p>

            <STErrorsDefault :error-box="errorBox"/>

            <div class="legal-footer">
                <hr class="style-hr"><div>
                    <aside>
                        <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                            {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                        </a>
                    </aside>
                    <div>
                        <a :href="'https://'+$domains.marketing+'/ledenadministratie'">{{ $t('81cf2ea9-da19-4d32-b270-e595dee2d5b0') }} <Logo/></a>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components';

defineProps<{
    errorBox: ErrorBox | null
}>()
</script>
