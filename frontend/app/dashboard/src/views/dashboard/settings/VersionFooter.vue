<template>
    <p class="style-description-small version-footer" @click="tapVersion">
        v{{ version }} ({{ nativeVersion }}, {{ environment }})
    </p>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AsyncComponent } from "@stamhoofd/components";
import { AppManager } from '@stamhoofd/networking';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

@Component({})
export default class VersionFooter extends Mixins(NavigationMixin) {
    get environment() {
        return STAMHOOFD.environment
    }

    get nativeVersion() {
        return AppManager.shared.nativeVersion ? ('App ' + AppManager.shared.nativeVersion) : "web"
    }


    get version() {
        return STAMHOOFD.VERSION || '0.0.0'
    }

    tapVersion() {
        this.openDevPanel(true)
    }

    openDevPanel(animated = true) {
        this.present({
            animated,
            adjustHistory: true,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: AsyncComponent(() => import(/* webpackChunkName: "DevPanelView" */ "./DevPanelView.vue"))
                })
            ]
        })
    }
}
</script>

<style lang="scss">
    .version-footer {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        user-select: none;
    }
</style>