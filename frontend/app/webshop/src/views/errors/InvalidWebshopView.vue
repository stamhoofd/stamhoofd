<template>
    <div class="st-view invalid-page-view">
        <main class="limit-width">
            <h1 v-if="!errorBox">
                Deze webshop bestaat niet
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
                        <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                            {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                        </a>
                    </aside>
                    <div>
                        <a :href="'https://'+$domains.marketing+'/webshops'">Webshop via <Logo /></a>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { ErrorBox, Logo, STErrorsDefault } from "@stamhoofd/components";

@Component({
    components: {
        Logo,
        STErrorsDefault
    }
})
export default class InvalidWebshopView extends Mixins(NavigationMixin){
    @Prop({ default: null })
        errorBox: ErrorBox | null
}
</script>
