<template>
    <div class="st-view group-list-view">
        <STNavigationBar :sticky="false">
            <template #left>
                <button v-if="canPop" class="button icon gray left arrow-left" @click="pop">
                    Terug
                </button>
            </template>
            <template #right>
                <button class="button icon gray left add">
                    Nieuw
                </button>
            </template>
        </STNavigationBar>

    
        <main>
            <h1>Groepen</h1>
            <p>Hier kan je de groepen binnen jouw vereniging beheren en bewerken. Je kan instellen wie zich kan inschrijven bij welke groepen op basis van leeftijd en geslacht. Als op basis van deze restricties, leden toch in meerdere groepen passen, dan krijgen ze de keuze tijdens het inschrijven. Je kan deze daarna nog goedkeuren of verplaatsen</p>
            <STList>
                <STListItem :selectable="true">
                    Kapoenen
                </STListItem>
                <STListItem>Wouters</STListItem>
                <STListItem>Jonggivers</STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem
    }
})
export default class GroupListView extends Mixins(NavigationMixin) {

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.group-list-view {
    background: $color-white;
}
</style>
