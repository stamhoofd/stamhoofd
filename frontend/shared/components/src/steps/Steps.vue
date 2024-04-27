<template>
    <div class="steps-layout">
        <div class="progress" :style="{ width: progress * 100 + '%' }" :class="{ hide: progress >= 1 }" />

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
import { CenteredMessage, STNavigationBar } from "@stamhoofd/components"
import { Component, Prop,Ref,Vue } from "vue-property-decorator";

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

    get progress() {
        return this.totalSteps && this.step ? ((this.step - 1) / this.totalSteps) : 0
    }

    updateProgress() {
        if (this.navigationController.components.length <= 1) {
            this.canPop = false
        }
        this.$nextTick(() => {
            this.canPop = (this.navigationController.mainComponent?.componentInstance() as any)?.isStepsPoppable ?? (this.navigationController.components.length > 1);
            this.step = (this.navigationController.mainComponent?.componentInstance() as any)?.step ?? -1;
            if (this.step == -1) {
                this.step = this.navigationController.components.length 
            }
        })
        
    }

    get canDismiss() {
        return (this.navigationController?.mainComponent?.componentInstance() as any)?.canDismiss ?? false
    }
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.steps-layout {
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);
    position: relative;

    > main {
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;
    }

    > .progress {
        position: fixed;
        left: 0;
        top: 0;
        height: 2px;
        pointer-events: none;
        background: $color-primary;
        border-top-right-radius: 1px;
        border-bottom-right-radius: 1px;
        width: 0;
        opacity: 1;
        transition: width 0.3s, opacity 0.3s;
        z-index: 300;

        &.hide {
            transition: width 0.3s, opacity 0.2s 0.3s;
            opacity: 0;
        }
    }
}

</style>
