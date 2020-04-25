<template>
    <div id="create-account-view" class="st-view">
        <STNavigationBar title="Maak jouw account">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Maak jouw account
        </STNavigationTitle>

        <main>
            <p>Met dit account zal je later moeten inloggen om toegang te krijgen tot jouw vereniging.</p>

            <STErrorsDefault :error-box="errorBox" />
            <STErrorsInput error-fields="user.email" :error-box="errorBox">
                <label class="style-label" for="email">Persoonlijk e-mailadres</label>
                <input
                    id="email"
                    ref="firstInput"
                    v-model="email"
                    class="input"
                    type="email"
                    placeholder="Jouw persoonlijk e-mailadres"
                    autocomplete="username"
                >
            </STErrorsInput>

            <STErrorsInput error-fields="user.password" :error-box="errorBox">
                <label class="style-label" for="password">Kies je wachtwoord</label>
                <input
                    id="password"
                    v-model="password"
                    class="input"
                    type="password"
                    placeholder="Kies een veilig wachtwoord"
                    autocomplete="new-password"
                >

                <label class="style-label" for="password-repeat">Herhaal je wachtwoord</label>
                <input
                    id="password-repeat"
                    v-model="passwordRepeat"
                    class="input"
                    type="password"
                    placeholder="Herhaal je nieuw wachtwoord"
                    autocomplete="new-password"
                >
            </STErrorsInput>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" @click="goNext">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { CreateOrganizationStruct } from '@stamhoofd-backend/app/src/organizations/structs/CreateOrganizationStruct';
import { RegisterStruct } from '@stamhoofd-backend/app/src/users/structs/RegisterStruct';
import { Sodium } from '@stamhoofd-common/crypto';
import { STError, STErrors } from '@stamhoofd-common/errors';
import { ErrorBox,STErrorsDefault, STErrorsInput } from "@stamhoofd-frontend/errors";
import { Server } from "@stamhoofd-frontend/networking";
import { ComponentWithProperties } from '@stamhoofd/shared/classes/ComponentWithProperties';
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue"
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins, Prop } from "vue-property-decorator";

import BackupCopyView from './BackupCopyView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider,
        STErrorsDefault,
        STErrorsInput
    }
})
export default class CreateAccountView extends Mixins(NavigationMixin) {
    @Prop() data: CreateOrganizationStruct;
    email = ""
    password = ""
    passwordRepeat = ""
    errors: STErrors | null = null
    /// An errorBox distributes the errors visually across multiple components that are able to handle them
    errorBox: ErrorBox | null = null

    async goNext() {
        if (this.password != this.passwordRepeat) {
            const errors = new STErrors(new STError({
                code: "invalid_field",
                message: "De opgegeven wachtwoorden komen niet overeen",
                field: "user.password"
            }))
            this.errorBox = new ErrorBox(errors)
            return;
        }

        const server = new Server()
        server.host = "http://localhost:9090";

        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const user = new RegisterStruct()
        user.email = this.email
        user.password = this.password
        user.publicKey = userKeyPair.publicKey
        user.adminSignature = await Sodium.signMessage(userKeyPair.publicKey, Buffer.from(organizationKeyPair.privateKey, "base64"))

        this.data.user = user

        this.data.publicKey = organizationKeyPair.publicKey
        
        this.errors = null;

        server.request({
            method: "POST",
            path: "/organizations",
            body: this.data
        }).then(data => {
            console.log(data)
            this.errorBox = null;

            this.navigationController?.push(new ComponentWithProperties(BackupCopyView), true, this.navigationController.components.length)
        }).catch(e => {
            if (e instanceof STErrors) {
                this.errors = e
                this.errorBox = new ErrorBox(e)
            }
            console.error(e)
        });

    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/layout/split-inputs.scss';
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/components/inputs.scss';
@use '@stamhoofd/scss/components/buttons.scss';
@use '@stamhoofd/scss/layout/view.scss';

#create-account-view {
    > main {
        p {
            @extend .style-description;
        }
    }
}
</style>
