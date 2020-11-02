<template>
    <section class="padded-view">
        <div class="webshop-view">
            <figure class="webshop-banner">
                <img :src="bannerImageSrc" :width="bannerImageWidth" :height="bannerImageHeight">
            </figure>

            <main>
                <h1>{{ webshop.meta.title }}</h1>
                <p v-text="webshop.meta.description" />

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

    get bannerImage() {
        return this.webshop.meta.coverPhoto?.getResolutionForSize(800, undefined)
    }
    
    get bannerImageWidth() {
        return this.bannerImage?.width
    }

    get bannerImageHeight() {
        return this.bannerImage?.height
    }

    get bannerImageSrc() {
        return this.bannerImage?.file.getPublicPath()
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

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
        }
    }

    > main {
        @extend .main-text-container;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 15px;

            + p {
                 white-space: pre-wrap;
            }
        }
    }
    
    @media (min-width: 801px) {
        max-width: 800px;
        margin: 0 auto;
        min-height: auto;
    }
}
</style>