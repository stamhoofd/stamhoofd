<template>
    <p class="style-description-small version-footer" @click="tapVersion">
        <span class="icon small commit" /><span>v{{ version }} ({{ nativeVersion }}, {{ environment }})</span>
    </p>
    <p v-if="STAMHOOFD.APP_UPDATE_SERVER_URL" class="style-description-small">
        <span class="icon small reverse" /><span>{{ STAMHOOFD.APP_UPDATE_SERVER_URL }}</span>
    </p>
    <p v-if="NetworkManager.serverName" class="style-description-small">
        <span class="icon small earth" /><span>{{ NetworkManager.serverName }}</span>
    </p>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';

const nativeVersion = AppManager.shared.nativeVersion ? ('App ' + AppManager.shared.nativeVersion) : 'web';
const version = STAMHOOFD.VERSION || '0.0.0';
const environment = STAMHOOFD.environment;

const present = usePresent();
async function tapVersion() {
    await present({
        adjustHistory: true,
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./DevPanelView.vue')),
            }),
        ],
    });
}

/*
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

    }
} */
</script>

<style lang="scss">
    .version-footer {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        user-select: none;
    }
</style>
