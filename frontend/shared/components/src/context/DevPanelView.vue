<template>
    <SaveView title="Developers" :loading="saving" @save="save">
        <h1>
            Developers
        </h1>

        <hr>
        <h2>Kanaal</h2>
        <STList>
            <STListItem v-for="r in availableChannels" :key="r.url" :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="releaseChannel" :value="r.url" />
                </template>
                <h3 class="style-title-list">
                    {{ r.name }}
                </h3>
                <p class="style-description-small">
                    {{ r.url }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="releaseChannel" value="custom" />
                </template>
                <h3 class="style-title-list">
                    Custom
                </h3>
                <input v-if="releaseChannel === 'custom'" v-model="customChannel" type="text" placeholder="Vul een URL in" class="input option">
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Radio, SaveView, STList, STListItem, Toast, TooltipDirective } from "@stamhoofd/components";
import { AppManager, Storage } from "@stamhoofd/networking";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        SaveView,
        Radio,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DevPanelView extends Mixins(NavigationMixin) {
    releaseChannel = ''
    customChannel = ''
    saving = false;
    availableChannels: {name: string, url: string}[] = []

    mounted() {        
        this.availableChannels = [
            {
                name: 'Standaard',
                url: STAMHOOFD.APP_UPDATE_SERVER_URL
            },
            {
                name: 'Production',
                url: STAMHOOFD.APP_UPDATE_PRODUCTION_SERVER_URL,
            },
            {
                name: 'Staging',
                url: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL,
            },
            {
                name: 'Development',
                url: STAMHOOFD.APP_UPDATE_DEVELOPMENT_SERVER_URL,
            },
        ].filter(c => c.url !== undefined) as any

        Storage.keyValue.getItem("UPDATE_SERVER").then((value) => {
            this.releaseChannel = value ?? ''
            this.customChannel = value ?? ''

            if (!this.availableChannels.find(c => c.url === value)) {
                this.releaseChannel = 'custom'
            }
        }).catch(console.error);
    }

    async saveChannel() {
        if (this.releaseChannel === '') {
            await Storage.keyValue.removeItem("UPDATE_SERVER")
        } if (this.releaseChannel === 'custom') {
            // Check valid
            new URL(this.customChannel)
            await Storage.keyValue.setItem("UPDATE_SERVER", this.customChannel)
        } else {
            await Storage.keyValue.setItem("UPDATE_SERVER", this.releaseChannel)
        }
        await AppManager.shared.checkUpdates({
            visibleCheck: 'text',
            visibleDownload: true,
            installAutomatically: true,
            checkTimeout: 15 * 1000,
            force: true,
            channel: this.releaseChannel === 'custom' ? this.customChannel : this.releaseChannel
        })
    }

    async save() {
        if (this.saving) {
            return;
        }
        this.saving = true

        try {
            await this.saveChannel()
            new Toast("Wijzigingen opgeslagen", "success").show()
            this.dismiss({force: true})
        } catch (e) {
            Toast.fromError(e as Error).show()
        }

        this.saving = false;
    }
}
</script>
