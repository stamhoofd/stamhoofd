<template>
    <div id="no-key-view" class="st-view background">
        <STNavigationBar title="Sleutel kwijt" />

        <main>
            <h1>
                Een nieuwe encryptie-sleutel maken
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <p class="style-description">
                Maak een nieuwe encryptie-sleutel aan. Jij en alle andere beheerders verliezen toegang tot de data. Je zal alle beheerders opnieuw een uitnodiging moeten versturen die ze moeten accepteren met hun bestaand account.
            </p>
            <p class="error-box">
                Doe dit enkel als er geen andere beheerders zijn die nog toegang hebben! Anders verlies je toegang tot alle gegevens.
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="dismiss">
                    Annuleren
                </button>
                <LoadingButton :loading="loading">
                    <button class="button destructive" @click="createKey">
                        Sleutel maken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { LoginHelper,SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
        STErrorsDefault
    },
})
export default class CreateNewKeyView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    async createKey() {
        if (this.loading) {
            return
        }
        this.loading = true
        this.errorBox = null

        try {
            await LoginHelper.changeOrganizationKey(SessionManager.currentSession!)
            window.location.reload()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false
        }
    }
}
</script>