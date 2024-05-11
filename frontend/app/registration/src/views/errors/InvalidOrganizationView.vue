<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                Deze vereniging bestaat niet
            </h1>
            <h1 v-else>
                Er ging iets mis
            </h1>
            <p>Kijk even na of de link klopt of probeer later opnieuw.</p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="legal-footer">
                <hr class="style-hr">
                <div>
                    <aside>
                        <a :href="'https://'+$t('shared.domains.marketing')" class="inline-link secundary" target="_blank">
                            Terug naar Stamhoofd
                        </a>
                    </aside>
                    <div>
                        <a :href="'https://'+$t('shared.domains.marketing')+'/ledenadministratie'">Ledenadministratie via <Logo /></a>
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
