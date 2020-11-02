<template>
    <section class="padded-view">
        <div class="webshop-view">
            <figure class="webshop-banner">
                <img :src="bannerImg">
            </figure>

            <main>
                <h1>{{ webshop.meta.name }}</h1>
                <p>Via ons online formulier kan je op voorhand een gerecht bestellen. Hiermee steun je onze werking op een coronaproof manier. We leveren ook aan huis met een leveringskost van 5 euro.</p>

                <CategoryBox v-for="category in webshop.categories" :key="category.id" :category="category" :webshop="webshop"/>
            </main>
        </div>
    </section>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { WebshopManager } from '../classes/WebshopManager';
import CategoryBox from "./products/CategoryBox.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        CategoryBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class WebshopView extends Mixins(NavigationMixin){
    get webshop() {
        return WebshopManager.webshop
    }

    get bannerImg() {
        return ""
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.webshop-view {

    .webshop-banner {
        width: 100%;
        height: 300px;
        background: $color-gray;
        border-radius: $border-radius;
        margin-bottom: 40px;
    }

    > main {
        @extend .main-text-container;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 15px;
        }
    }
    
    @media (min-width: 801px) {
        max-width: 800px;
        margin: 0 auto;
        min-height: auto;
    }
}
</style>