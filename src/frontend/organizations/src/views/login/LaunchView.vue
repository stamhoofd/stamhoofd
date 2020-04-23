<template>
    <div id="launch-window" class="st-view">
        <STNavigationBar />
        <main>
            <img src="@stamhoofd/assets/images/logo/logo-horizontal.svg" class="logo">
            <h1>Beheer je leden digitaal, zoals het hoort.</h1>
            <p>Probeer Stamhoofd gratis uit voor je vereniging of log in bij je vereniging die al is aangesloten.</p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" @click="createNew">
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
import { ComponentWithProperties } from '@stamhoofd/shared/classes/ComponentWithProperties';
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import NavigationController from "@stamhoofd/shared/components/layout/NavigationController.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins } from "vue-property-decorator";

import GeneralView from '../create-organization/GeneralView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar
    }
})
export default class ChooseOrganizationView extends Mixins(NavigationMixin) {
    createNew() {
        this.present(new ComponentWithProperties(NavigationController, {root: new ComponentWithProperties(GeneralView)}));
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

#launch-window {
    > main {
        .logo {
            display: block;
            margin-bottom: 30px;
        }

        h1 {
            @extend .style-title-1;
            margin-bottom: 10px;;
        }
        
        p {
            @extend .style-description;
        }
    }
}
</style>
