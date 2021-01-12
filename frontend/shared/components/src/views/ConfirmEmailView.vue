<template>
    <div class="boxed-view">
        <form class="confirm-email-view st-view small" @submit.prevent="submit">
            <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration">

            <main>
                <h1>Vul de code in die we jou hebben gestuurd via e-mail</h1>

                <p>Als je jouw e-mail op deze computer opent, kan je ook de link in de e-mail gebruiken.</p>

                <STErrorsDefault :error-box="errorBox" />

                <CodeInput v-model="code" />
                {{ code }}
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary full">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </form>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, CodeInput,EmailInput, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { LoginHelper,NetworkManager, Session, SessionManager } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        Checkbox,
        Spinner,
        STToolbar,
        CodeInput
    }
})
export default class ConfirmEmailView extends Mixins(NavigationMixin){
    errorBox: ErrorBox | null = null
    loading = false
    code = ""

    submit() {
        // todo
        this.code = "123456"
    }

    async shouldNavigateAway() {
        return await CenteredMessage.confirm("Ben je zeker dat je wilt annuleren?", "Sluiten en niet voltooien")
    }
}
</script>

<style lang="scss">
    .confirm-email-view {
        text-align: center;

        .email-illustration {
            width: 100px;
            height: 100px;
            display: block;
            margin: 0 auto;
            margin-bottom: 20px;
        }
    }
</style>