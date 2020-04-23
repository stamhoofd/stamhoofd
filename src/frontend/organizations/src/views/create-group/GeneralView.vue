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
                <a href="https://stamhoofd.be">Stamhoofd</a>
            </template>
            <template #right>
                <button class="button primary" @click="goNext">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Server } from "@stamhoofd-frontend/networking";
import { ComponentWithProperties } from '@stamhoofd/shared/classes/ComponentWithProperties';
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins } from "vue-property-decorator";

import CreateAccountView from "./CreateAccountView.vue"

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider
    }
})
export default class GeneralView extends Mixins(NavigationMixin) {
    mounted() {
        const server = new Server()
        server.host = "http://localhost:9090";

        server.request({
            method: "GET",
            path: "/",
        }).then(data => {
            console.log(data)
        }).catch(e => {
            console.error(e)
        });
    }

    goNext() {
        this.show(new ComponentWithProperties(CreateAccountView))
    }
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
