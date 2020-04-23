<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent :root="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import ModalStackComponent from "@stamhoofd/shared/components/layout/ModalStackComponent.vue";
import StackComponent from "@stamhoofd/shared/components/layout/StackComponent.vue";
import { Component, Prop, Vue } from "vue-property-decorator";



@Component({
    components: {
        ModalStackComponent,
        StackComponent,
    },
})
export default class Window extends Vue {
    @Prop(ComponentWithProperties) readonly root: ComponentWithProperties

    mounted() {
        if (window.process) {
            // We are running in electron
            console.log("We are running in electron. Add a safe area to the top");

            if (window.process.platform == "darwin") {
                // Traffic lights
                const size = 30
                document.documentElement.style.setProperty("--st-safe-area-top", `${size}px`);
            } else {
                console.log("Safe area top not supported")
            }

        } else {
            console.log("We are not running electron");
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/reset.scss";
@use "@stamhoofd/scss/base/text-styles.scss";
@use "@stamhoofd/scss/elements/body.scss";
@use "@stamhoofd/scss/components/logo.scss";
</style>
