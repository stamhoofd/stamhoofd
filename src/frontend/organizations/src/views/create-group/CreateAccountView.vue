<template>
    <div id="create-account-view" class="st-view">
        <STNavigationBar title="Maak jouw account">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Maak jouw account
        </STNavigationTitle>

        <main>
            <p>Met dit account zal je later moeten inloggen om toegang te krijgen tot jouw vereniging.</p>

            <label class="style-label" for="email">Persoonlijk e-mailadres</label>
            <input
                id="email"
                ref="firstInput"
                class="input"
                type="email"
                placeholder="Jouw persoonlijk e-mailadres"
                autocomplete="username"
            >

            <label class="style-label" for="password">Kies je wachtwoord</label>
            <input
                id="password"
                class="input"
                type="password"
                placeholder="Kies een veilig wachtwoord"
                autocomplete="new-password"
            >

            <label class="style-label" for="password-repeat">Herhaal je wachtwoord</label>
            <input
                id="password-repeat"
                class="input"
                type="password"
                placeholder="Herhaal je nieuw wachtwoord"
                autocomplete="new-password"
            >
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" @click="goNext">
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
import { ComponentWithProperties } from '@stamhoofd/shared/classes/ComponentWithProperties';
import OrganizationStructureView from "./OrganizationStructureView.vue"

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider
    }
})
export default class CreateAccountView extends Mixins(NavigationMixin) {
    goNext() {
        this.show(new ComponentWithProperties(OrganizationStructureView))
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

#create-account-view {
    > main {
        p {
            @extend .style-description;
        }
    }
}
</style>
