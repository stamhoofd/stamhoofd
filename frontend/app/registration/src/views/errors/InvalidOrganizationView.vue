<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1 v-if="!errorBox">
                Deze vereniging bestaat niet
            </h1>
            <h1 v-else>
                Er ging iets mis
            </h1>
            <p>Kijk even na of de link klopt of probeer later opnieuw.</p>

            <STErrorsDefault :error-box="errorBox" />
        </main>

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
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Logo, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        Logo,
        STErrorsDefault
    }
})
export default class InvalidOrganizationView extends Mixins(NavigationMixin){
    @Prop({ default: null })
        errorBox: ErrorBox | null
}
</script>