<template>
    <div id="general-view" class="st-view">
        <STNavigationBar title="Jouw vereniging aansluiten">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Jouw vereniging aansluiten
        </STNavigationTitle>
        
        <main>
            <div class="split-inputs">
                <div>
                    <label class="style-label" for="organization-name">Naam van je vereniging</label>
                    <input
                        id="organization-name"
                        ref="firstInput"
                        class="input"
                        type="text"
                        placeholder="De naam van je vereniging"
                        autocomplete="organization"
                    >

                    <label class="style-label" for="organization-count">Hoeveel leden hebben jullie ongeveer?</label>
                    <Slider />
                </div>

                <div>
                    <label class="style-label">Adres van je vereniging</label>
                    <input class="input" type="text" placeholder="Straat en number" autocomplete="address-line1">
                    <div class="input-group">
                        <div>
                            <input class="input" type="text" placeholder="Postcode" autocomplete="postal-code">
                        </div>
                        <div>
                            <input class="input" type="text" placeholder="Gemeente" autocomplete="city">
                        </div>
                    </div>

                    <select class="input">
                        <option>België</option>
                        <option>Nederland</option>
                    </select>
                </div>
            </div>
        </main>

        <STToolbar>
            <template #left>
                Volledig gratis tot je de demo beïndigd
            </template>
            <template #right>
                <button class="button primary">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue"

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider
    }
})
export default class GeneralView extends Mixins(NavigationMixin) {
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/layout/split-inputs.scss';
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/components/inputs.scss';
@use '@stamhoofd/scss/components/buttons.scss';
@use '@stamhoofd/scss/layout/view.scss';

#general-view {
    > main {
        h1 {
            @extend .style-title-1;
            margin-bottom: 10px;;
        }
    }
}
</style>
