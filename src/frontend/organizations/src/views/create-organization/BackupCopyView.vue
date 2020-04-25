<template>
    <div id="backup-copy-view" class="st-view">
        <STNavigationBar title="Bewaar je herstelsleutels" />
        <STNavigationTitle>
            Bewaar je herstelsleutels
        </STNavigationTitle>

        <main>
            <p>Om de gegevens van de leden te versleutelen maken we gebruik van end-to-end encryptie. De sleutels hiervan worden op jouw computer opgeslagen. Om te voorkomen dat je deze verliest, raden we je aan om nu al een (veilige) herstelsleutel te maken. </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" @click="skip">
                    Overslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from '@stamhoofd/shared/classes/ComponentWithProperties';
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins, Prop } from "vue-property-decorator";

import ConfirmEmailView from "./ConfirmEmailView.vue"

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle
    }
})
export default class BackupCopyView extends Mixins(NavigationMixin) {
    skip() {
        if (window.confirm("Zonder herstelsleutels kan je mogelijk alle data van je leden verliezen. Voeg deze zeker in de toekomst toe.")) {
            this.show(new ComponentWithProperties(ConfirmEmailView))
        }
    }
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

#backup-copy-view {
    > main {
        p {
            @extend .style-description;
        }
    }
}
</style>
