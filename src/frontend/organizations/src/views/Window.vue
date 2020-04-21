<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent :root="root" />
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import ModalStackComponent from "@stamhoofd/shared/components/layout/ModalStackComponent.vue";
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import StackComponent from "@stamhoofd/shared/components/layout/StackComponent.vue";



@Component({
    components: {
        ModalStackComponent,
        StackComponent,
    },
})
export default class Window extends Vue {
    @Prop(ComponentWithProperties) readonly root: ComponentWithProperties

    mounted() {
        if (window.process && window.process.versions && (window.process.versions as any).electron) {
            // We are running in electron
            console.log("We are running in electron. Add a safe area to the top");

            const electron = window.require('electron')
            const mainWindow = electron.remote.getCurrentWindow();

            console.log(window.process.platform)
            if (window.process.platform == "darwin") {
                // Traffic lights
                const size = 30
                document.documentElement.style.setProperty("--st-safe-area-top", `${size}px`);
            } else {
                const size = mainWindow.getSize()[1] - mainWindow.getContentSize()[1]
                document.documentElement.style.setProperty("--st-safe-area-top", `${size}px`);
                console.log("Safe area top", size)
            }

        } else {
            console.log("We are not running electron");
            console.log(window.process.versions);
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
