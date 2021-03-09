<template>
    <div class="steps-layout">
        <STNavigationBar :large="true" :fixed="true" :progress="totalSteps && step ? ((step - 1) / totalSteps) : 0">
            <template #left>
                <slot name="left" :step="step" :canPop="canPop">
                    <transition name="move" mode="out-in">
                        <a v-if="!canPop" id="logo" class="responsive" alt="Stamhoofd" href="https://www.stamhoofd.be" target="_blank" rel="noopener" />
                        <div v-else @click.prevent="goBack()">
                            Terug
                        </div>
                    </transition>
                </slot>
            </template>
            <template #center>
                <slot name="center" :step="step" :canPop="canPop">
                    <span v-if="totalSteps && step && step <= totalSteps" class="style-caption">Stap {{ step }} / {{ totalSteps }}</span>
                </slot>
            </template>
            <template #right>
                <slot name="right" :step="step" :canPop="canPop" />
            </template>
        </STNavigationBar>

        <main>
            <NavigationController
                ref="navigationController"
                :root="root"
                @didPop="updateProgress"
                @didPush="updateProgress"
            />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { Component, Prop,Ref,Vue } from "vue-property-decorator";
import { STNavigationBar } from "@stamhoofd/components"

import StepsHeader from "./StepsHeader.vue";

@Component({
    components: {
        StepsHeader,
        NavigationController,
        STNavigationBar
    },
})
export default class Steps extends Vue {
    step = 0;

    canPop = false

    @Prop({ default: null })
    totalSteps!: number | null

    @Prop({ required: true })
    root!: ComponentWithProperties

    @Ref("navigationController") readonly navigationController!: NavigationController;

    goBack() {
        //this.step--;
        this.navigationController.pop().catch(e => {
            console.error(e)
        });
    }

    updateProgress() {
        if (this.navigationController.components.length <= 1) {
            this.canPop = false
        }
        this.$nextTick(() => {
            this.canPop = (this.navigationController.mainComponent?.componentInstance() as any)?.isStepsPoppable ?? (this.navigationController.components.length > 1);
            this.step = (this.navigationController.mainComponent?.componentInstance() as any)?.step ?? 0;
            if (this.step == -1) {
               this.step = this.navigationController.components.length 
            }
        })
        
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles' as *;

$header-height: 70px;

.steps-layout {
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);

    @media (max-width: 800px) {
        background: $color-white;
    }

    

    > main {
        --st-safe-area-top: 90px;
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;

        @media (min-width: 801px) {
            --st-vertical-padding: 60px;
        }
        
    }

    
}

.steps-layout {
    /*.padded-view, .boxed-view {
        padding-top: $header-height;
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;

        @media (min-width: 801px) {
            padding-top: $header-height + 10px;
            padding-bottom: $header-height;
        }
    }*/

    .boxed-view {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;
        padding: var(--st-vertical-padding, 20px) var(--st-horizontal-padding, 40px) var(--st-vertical-padding, 20px) var(--st-horizontal-padding, 40px);
        padding: calc(var(--st-vertical-padding, 20px) + var(--st-safe-area-top, 0px)) var(--st-horizontal-padding, 40px) var(--st-vertical-padding, 20px) var(--st-horizontal-padding, 40px);
        background: $color-background-shade;

        > .st-view {
            // We fixed the safe area, no need to recorrect it again
            --st-safe-area-top: 0px;
            width: 100%;

            &:not(:only-child) {
                min-height: auto;

                &:not(:last-child) {
                    border-bottom: $border-width solid $color-white-shade;
                    margin-bottom: 20px;

                    @media (min-width: 801px) {
                        margin-bottom: 30px;
                    }
                }
            }
            
            @media (min-width: 801px) {
                max-width: 800px;
                background: $color-white;
                @include style-side-view-shadow();
                border-radius: $border-radius;
                margin: 0 auto;
                min-height: auto;

                &.small {
                    max-width: 500px;
                }
            }
        }
    }
}



</style>
