<template>
    <div class="steps-layout">
        <StepsHeader :progress="totalSteps && step ? ((step - 1) / totalSteps) : 0">
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
        </StepsHeader>

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

import StepsHeader from "./StepsHeader.vue";

@Component({
    components: {
        StepsHeader,
        NavigationController,
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
    background: $color-white-shade;
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);

    @media (max-width: 800px) {
        background: $color-white;
    }

    > header {
        > div {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            height: $header-height - 30px;
            display: flex;
            flex-direction: row;
            padding: 15px 15px;
            z-index: 10;

            background: $color-white-shade;

            @media (max-width: 800px) {
                background: $color-white;
            }

            &::before {
                content: "";
                left: 0;
                right: 0;
                top: $header-height;
                height: 50px;
                background: linear-gradient($color-white-shade, rgba($color-white-shade, 0));
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s;
                position: absolute;

                @media (max-width: 800px) {
                    background: linear-gradient($color-white, rgba($color-white, 0));
                }
            }

            > .progress {
                position: absolute;
                left: 0;
                top: 0;
                height: $border-width;
                pointer-events: none;
                background: $color-primary;
                border-top-right-radius: $border-width/2;
                border-bottom-right-radius: $border-width/2;
                width: 0;
                opacity: 1;
                transition: width 0.3s, opacity 0.3s;

                &.hide {
                    transition: width 0.3s, opacity 0.2s 0.3s;
                    opacity: 0;
                }
            }

            > .left {
                flex-grow: 1;
                flex-basis: 0;
                flex-shrink: 10;
                text-align: left;

                display: flex;
                align-items: center;
                justify-content: flex-start;
            }

            > .right {
                flex-grow: 1;
                flex-basis: 0;
                flex-shrink: 10;

                display: flex;
                align-items: center;
                justify-content: flex-end;

                .button {
                    margin: 0 10px;

                    @media (max-width: 450px) {
                        margin: 0 10px;
                    }

                    &:first-child {
                        margin-left: 0;
                    }

                    &:last-child {
                        margin-right: 0;
                    }
                }
            }

            > .center {
                padding: 10px;
                flex-basis: 0;
                flex-shrink: 0;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }

        &[data-scrolled="true"] {
            & > div {
                &::before {
                    opacity: 1;
                }
            }
        }
    }

    > main {
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;

        @media (min-width: 801px) {
            --st-vertical-padding: 60px;
        }
        
    }
}

.steps-layout {
    .padded-view, .boxed-view {
        padding-top: $header-height;
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;

        @media (min-width: 801px) {
            padding-top: $header-height + 10px;
            padding-bottom: $header-height;
        }
    }

    .boxed-view {
        @media (min-width: 801px) {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        > .st-view {
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
            }
        }
    }
}



</style>
