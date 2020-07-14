<template>
    <div class="st-view auto" v-if="members.length == 0">
        <main>
            <h1>Je hebt nog niemand ingeschreven</h1>
            <p>Je hebt nog niemand ingeschreven voor dit werkjaar. Begin met iemand in te schrijven.</p>
        </main>
        <STToolbar>
            <button class="primary button add" slot="right">
                <span class="icon white add"/>
                Lid inschrijven
            </button>
        </STToolbar>
    </div>
    <div class="st-view auto" v-else>
        <main>
            <h1>Ingeschreven leden</h1>
            <p>Hier kan je inschrijvingen bewerken of nog iemand anders inschrijven.</p>
        </main>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar } from "@stamhoofd/components"

@Component({
    components: {
        STNavigationBar,
        STToolbar
    }
})
export default class OverviewView extends Mixins(NavigationMixin){
    members: any[] = []
}
</script>