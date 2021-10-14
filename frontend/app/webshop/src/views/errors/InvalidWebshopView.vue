<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1 v-if="!errorBox">
                Deze webshop bestaat niet
            </h1>
            <h1 v-else>
                Er ging iets mis
            </h1>

            <p>Kijk even na of de link klopt of probeer later opnieuw.</p>

            <STErrorsDefault :error-box="errorBox" />
        </main>

        <div class="legal-footer">
            <hr class="style-hr">
            <div>
                <aside>
                    <a href="https://www.stamhoofd.be" class="inline-link secundary" target="_blank">
                        Terug naar stamhoofd.be
                    </a>
                </aside>
                <div>
                    <a href="https://www.stamhoofd.be/webshops">Webshop via <Logo /></a>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox,Logo, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        Logo,
        STErrorsDefault
    }
})
export default class InvalidWebshopView extends Mixins(NavigationMixin){
    @Prop({ default: null })
    errorBox: ErrorBox | null
}
</script>


<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.invalid-page-view {
    .legal-footer {
        @extend .style-description-small;
        padding-top: 30px;
        margin-top: auto;
        line-height: 1.6;

        > div {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap-reverse;

            @media (max-width: 500px) {
                .stamhoofd-logo-container {
                    svg {
                        width: 120px;
                    }
                }
            }

            > div, > aside {
                &:first-child {
                    padding-right: 10px;
                }

                &:last-child {
                    --color-primary: #{$color-primary-original};
                    flex-shrink: 0;
                    text-align: right;

                    a {
                        display: flex;
                        flex-direction: row;
                        align-items: center;

                        > :last-child {
                            margin-left: 10px;
                        }

                        &, &:hover, &:link, &:active, &:visited {
                            color: $color-gray;
                            font-weight: 600;
                            text-decoration: none;
                        }
                    }
                }
            }
        }
    }
}
</style>