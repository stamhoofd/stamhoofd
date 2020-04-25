<template>
    <div id="confirm-email-view" class="st-view">
        <STNavigationBar title="Bevestig je e-mailadres">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Bevestig je e-mailadres
        </STNavigationTitle>

        <main>
            <p>Je hebt een e-mail ontvangen waarmee je je e-mailadres kan bevestigen.</p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary">
                    Niet ontvangen?
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins } from "vue-property-decorator";


@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle
    }
})
export default class ConfirmEmailView extends Mixins(NavigationMixin) {
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

#confirm-email-view {
    > main {
        p {
            @extend .style-description;
        }
    }
}
</style>
