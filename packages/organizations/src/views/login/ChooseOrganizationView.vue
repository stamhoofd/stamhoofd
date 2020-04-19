<template>
    <div id="launch-window" class="st-view">
        <STNavigationBar />
        <main>
            <img src="@stamhoofd/assets/images/logo/logo-horizontal.svg" class="logo">
            <h1>Beheer je leden digitaal, zoals het hoort.</h1>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary">
                    Nieuwe vereniging aansluiten
                </button>
                <button class="button secundary">
                    Inloggen bij vereniging
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

@Component({
    components: {
        STToolbar,
        STNavigationBar
    }
})
export default class ChooseOrganizationView extends Mixins(NavigationMixin) {
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/layout/split-inputs.scss';
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/components/inputs.scss';
@use '@stamhoofd/scss/components/buttons.scss';
@use '@stamhoofd/scss/layout/view.scss';

#launch-window {
    > main > h1 {
        @extend .style-huge-title-1;
    }

    .logo {
        display: block;
        margin-bottom: 20px;
    }
}
</style>
