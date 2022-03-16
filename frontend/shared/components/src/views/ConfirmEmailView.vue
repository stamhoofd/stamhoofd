<template>
    <div class="boxed-view">
        <form class="confirm-email-view st-view small" @submit.prevent="submit">
            <STNavigationBar>
                <LoadingButton slot="right" :loading="retrying">
                    <button class="button text" type="button" @click="retry">
                        <span class="icon retry" />
                        <span>Opnieuw</span>
                    </button>
                </LoadingButton>
            </STNavigationBar>
            <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration">

            <main>
                <h1 v-if="!login">
                    Vul de code in uit de e-mail die we hebben gestuurd
                </h1>
                <h1 v-else>
                    Verifieer jouw e-mailadres. Vul de code in uit de e-mail die we hebben gestuurd
                </h1>

                <p>Er werd een e-mail verstuurd naar '{{ email }}'. Vul de code uit de e-mail in of klik op de link in de e-mail en wacht enkele seconden. E-mail niet ontvangen? Kijk in jouw spambox!</p>

                <div><CodeInput v-model="code" @complete="submit" /></div>

                <div><STErrorsDefault :error-box="errorBox" /></div>
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary full" type="button">
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

    @Prop({ required: true })
    email!: string

    @Prop({ default: false })
    login!: boolean

    @Prop({ required: true })
    session!: Session

    timer: any = null

    startTime = new Date()

    mounted() {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        this.timer = setTimeout(this.poll.bind(this), 10000)
    }

    stopPolling() {
        if (this.timer) {
            console.log("Stopped e-mail polling")
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    destroyed() {
        this.stopPolling()
    }

    retrying = false

    async retry() {
        if (this.retrying) {
            return
        }

        if (new Date().getTime() - this.startTime.getTime() < 5 * 60 * 1000) {
            new Toast("Je moet minimaal 5 minuten wachten voor je een nieuwe e-mail kan versturen. Kijk jouw inbox goed na!", "error red").show()
            return
        }
        // todo
        if (!await CenteredMessage.confirm("Wil je een nieuwe bevestigingsmail sturen?", "Ja, versturen", "Kijk ook zeker in jouw spambox, wacht enkele minuten en kijk opnieuw. Kijk ook na of je geen typefouten hebt gemaakt in jouw e-mailadres (dan maak je best een nieuw account aan).")) {
            return
        }

        this.retrying = true

        try {
            const stop = await LoginHelper.retryEmail(this.session, this.token)
            this.startTime = new Date()
            if (stop) {
                this.dismiss({ force: true })
                return
            }
            new Toast("Je hebt een nieuwe e-mail ontvangen. Kijk jouw inbox en spambox goed na!", "email").show()
        } catch (error) {
            this.errorBox = new ErrorBox(error)
        }
        this.retrying = false
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
            // Prevent closing now that we showed an error
            this.stopPolling()
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