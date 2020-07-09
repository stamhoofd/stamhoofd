<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account">
            <button slot="left" type="button" class="button icon gray left arrow-left" @click="pop">
                Terug
            </button>
        </STNavigationBar>

        <main>
            <h1>
                Maak jouw account
            </h1>
            <p>
                Alle gegevens van jouw leden worden in een versleutelde digitale kluis bijgehouden - ook Stamhoofd heeft hier geen toegang tot. Het is belangrijk dat je de toegang tot die kluis goed beschermd met sterke wachtwoorden. Doe dit om de gegevens van jouw leden te beschermen, het is jouw plicht om hun persoonsgegevens te beschermen.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <STInputBox title="E-mailadres">
                        <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
                    </STInputBox>

                    <STInputBox title="Kies een wachtwoord">
                        <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>
                </div>

                <div>
                    <div class="warning-box">
                        Kies een wachtwoord van minstens 14 karakters. We raden je heel sterk aan om een wachtwoordbeheerder te gebruiken en een wachtwoord te kiezen dat nog veel langer is (en automatisch gegenereerd).
                    </div>
                </div>
            </div>
        </main>

        <STToolbar>
            <template #left>
                Het aanmaken van de verenging kan een tiental seconden duren afhankelijk van de rekenkracht van jouw toestel.
            </template>
            <template #right>
                <Spinner v-if="loading" />
                <button class="button primary">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Spinner,STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { KeyConstantsHelper, SensitivityLevel, Sodium } from "@stamhoofd/crypto"
import { Component, Mixins } from "vue-property-decorator";
import GenerateWorker from 'worker-loader!../../workers/generateAuthKeys.ts';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        Spinner
    }
})
export default class SignupAccountView extends Mixins(NavigationMixin) {
    name = ""
    errorBox: ErrorBox | null = null

    password = ""
    passwordRepeat = ""
    email = ""

    loading = false

    async goNext() {
        if (this.loading) {
            return
        }

        try {
            // todo: validate details

            // Generate keys
            this.loading = true
            this.errorBox = null

            const myWorker = new GenerateWorker();

            myWorker.onmessage = (e) => {
                console.info(e)
                // todo
                console.log('Message received from worker');
                myWorker.terminate();
                this.loading = false
            }

             myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                this.loading = false
            }

            myWorker.postMessage(this.password);

        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                console.log("Updated errorbox")
                this.errorBox = new ErrorBox(e)
            }
            return;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-account-view {
}
</style>
