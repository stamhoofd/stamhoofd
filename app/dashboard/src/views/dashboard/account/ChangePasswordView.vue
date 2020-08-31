<template>
    <form class="auto st-view login-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Wachtwoord wijzigen</h1>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Kies een wachtwoord">
                <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
            </STInputBox>

            <STInputBox title="Herhaal wachtwoord">
                <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="lock icon" />
                    <span>Wijzigen</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, ErrorBox, Validator, STErrorsDefault, Toast } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { NetworkManager,Session, SessionManager, LoginHelper } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { SimpleError } from '@simonbackx/simple-errors';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault
    }
})
export default class ChangePasswordView extends Mixins(NavigationMixin){
    loading = false

    password = ""
    passwordRepeat = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    async submit() {
        if (this.loading) {
            return
        }

        // Request the key constants

        if (this.password != this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            }))
            return;
        }

        if (this.password.length < 14) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Jouw wachtwoord moet uit minstens 14 karakters bestaan."
            }))
            return;
        }
        this.loading = true

        const component = new ComponentWithProperties(CenteredMessage, { 
            type: "loading",
            title: "Wachtwoord wijzigen...", 
            description: "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even. "
        }).setDisplayStyle("overlay");
        this.present(component)

        try {
            await LoginHelper.changePassword(SessionManager.currentSession!, this.password)
            this.dismiss({ force: true });
            HistoryManager.setUrl("/")
            new Toast('Jouw nieuwe wachtwoord is opgeslagen', "success").show()
        } catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e)
            return;
        } finally {
            (component.componentInstance() as any)?.pop()
        }
    }
}
</script>
