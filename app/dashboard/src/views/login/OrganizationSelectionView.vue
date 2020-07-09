<template>
    <div class="organization-selection-view">
        <h1>Kies je vereniging</h1>
        <p>Selecteer de vereniging waar je wilt inloggen.</p>
        <input class="input search" placeholder="Zoek op postcode of naam">

        <Spinner v-if="loading" class="gray center" />

        <button class="search-result" @click="loginOrganization()">
            <h1>Scouts Prins Boudewijn</h1>
            <p>Groene wegel 2, 9230 Wetteren</p>
        </button>

        <button class="search-result">
            <h1>Scouts Prins Boudewijn</h1>
            <p>Groene wegel 2, 9230 Wetteren</p>
        </button>

        <button class="search-result">
            <h1>Scouts Prins Boudewijn</h1>
            <p>Groene wegel 2, 9230 Wetteren</p>
        </button>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import Spinner from "@stamhoofd/components/src/Spinner.vue";
import { Component, Mixins } from "vue-property-decorator";

import LoginView from './LoginView.vue';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        Spinner
    }
})
export default class OrganizationSelectionView extends Mixins(NavigationMixin){
    loading = true;

    mounted() {
        console.log("mounted organization selection")
    }

    loginOrganization() {
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(LoginView, { organization: null }) }).setDisplayStyle("sheet"))
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    .organization-selection-view {
        padding: 20px;
        padding-top: 100px;

        max-width: 400px;
        margin: 0 auto;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 10px;
        }

        > p {
            @extend .style-description;
        }

        > .spinner-container {
            padding: 10px 0;
        }

        > .search-result {
            @extend .style-input-shadow;
            background: $color-white url('~@stamhoofd/assets/images/icons/gray/arrow-right-small.svg') right 10px center no-repeat;
            border: $border-width solid $color-gray-light;
            padding: 20px 20px;
            border-radius: $border-radius;
            margin: 10px 0;
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
            touch-action: manipulation;
            user-select: none;
            display: block;
            width: 100%;
            text-align: left;

            > h1 {
                @extend .style-title-3;
                padding-bottom: 2px;
            }

            > p {
                @extend .style-description;
            }

            &:hover {
                border-color: $color-primary-gray-light;
            }


            &:active {
                transform: scale(0.95, 0.95);
                border-color: $color-primary;
            }
        }
    }
</style>
