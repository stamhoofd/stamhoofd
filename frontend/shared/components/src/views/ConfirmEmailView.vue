<template>
    <div class="boxed-view">
        <form class="confirm-email-view st-view small" @submit.prevent="submit">
            <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration">

            <main>
                <h1 v-if="!login">
                    Vul de code in uit de e-mail die we hebben gestuurd
                </h1>
                <h1 v-else>
                    Verifieer jouw e-mailadres. Vul de code in uit de e-mail die we hebben gestuurd
                </h1>

                <p>Of klik op de link in de e-mail en wacht enkele seconden.</p>

                <div><CodeInput v-model="code" @complete="submit" /></div>

                <STErrorsDefault :error-box="errorBox" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, CodeInput,EmailInput, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { LoginHelper, Session } from '@stamhoofd/networking';
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
    polling = false
    pollCount = 0
    code = ""

    @Prop({ required: true })
    token!: string

    @Prop({ default: false })
    login!: boolean

    @Prop({ required: true })
    session!: Session

    timer: any = null

    mounted() {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        this.timer = setTimeout(this.poll.bind(this), 10000)
    }

    destroyed() {
        if (this.timer) {
            console.log("Stopped e-mail polling")
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    async poll() {
        if (this.polling) {
            return
        }
        this.polling = true

        try {
            const stop = await LoginHelper.pollEmail(this.session, this.token)
            if (stop) {
                this.dismiss({ force: true })
                return
            }
        } catch (e) {
            console.error(e)
        }
        this.pollCount++
        this.polling = false

        if (this.pollCount > 150) {
            // Stop after 12 minutes
            return
        }
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        this.timer = setTimeout(this.poll.bind(this), Math.max(this.pollCount*1000, 5*1000))
    }

    async submit() {
        if (this.loading) {
            return
        }

        // Send request
        this.loading = true

        try {
            await LoginHelper.verifyEmail(this.session, this.code, this.token)
            new Toast("Jouw e-mailadres is geverifieerd!", "success green").setHide(3000).show()

            // Yay!
            // we could be sign in, or couldn't.
            // if signed in: we'll automitically get deallocated
            // so always return
            this.dismiss({ force: true })

        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
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