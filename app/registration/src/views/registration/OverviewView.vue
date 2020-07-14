<template>
    <div class="st-view auto">
        <main>
            <h1>Ingeschreven leden</h1>
            <p>Hier kan je inschrijvingen bewerken of nog iemand anders inschrijven.</p>
        </main>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar } from "@stamhoofd/components"

@Component({
    components: {
        STNavigationBar
    }
})
export default class OverviewView extends Mixins(NavigationMixin){

}
</script>