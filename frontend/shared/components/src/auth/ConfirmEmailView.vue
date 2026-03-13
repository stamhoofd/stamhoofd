<template>
    <form class="confirm-email-view st-view small" @submit.prevent="submit">
        <STNavigationBar>
            <template #right>
                <LoadingButton :loading="retrying">
                    <button class="button text" type="button" @click="retry">
                        <span class="icon retry" />
                        <span>{{ $t('%Y9') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STNavigationBar>
        <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration"><main class="center">
            <h1 v-if="!login">
                {{ $t('%ZS') }}
            </h1>
            <h1 v-else>
                {{ $t('%ZT') }}
            </h1>

            <p>{{ $t("%ZU", {email}) }}</p>

            <div><CodeInput v-model="code" @complete="submit" /></div>

            <div><STErrorsDefault :error-box="errorBox" /></div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary full" type="button">
                        <span>{{ $t('%16p') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import Checkbox from '#inputs/Checkbox.vue';
import CodeInput from '#inputs/CodeInput.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import Spinner from '#Spinner.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STFloatingFooter from '#navigation/STFloatingFooter.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { Toast } from '#overlays/Toast.ts';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';

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
        CodeInput,
    },
})
export default class ConfirmEmailView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    loading = false;
    polling = false;
    pollCount = 0;
    code = '';

    @Prop({ required: true })
    token!: string;

    @Prop({ required: true })
    email!: string;

    @Prop({ default: false })
    login!: boolean;

    timer: any = null;

    startTime = new Date();

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 10000);
    }

    stopPolling() {
        if (this.timer) {
            console.log('Stopped e-mail polling');
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    unmounted() {
        this.stopPolling();
    }

    retrying = false;

    async retry() {
        if (this.retrying) {
            return;
        }

        if (new Date().getTime() - this.startTime.getTime() < 5 * 60 * 1000 && STAMHOOFD.environment !== 'development') {
            new Toast($t(`%uj`), 'error red').show();
            return;
        }
        // TODO
        if (!await CenteredMessage.confirm($t(`%uk`), $t(`%ul`), $t(`%um`))) {
            return;
        }

        this.retrying = true;

        try {
            const stop = await LoginHelper.retryEmail(this.$context, this.token);
            this.startTime = new Date();
            if (stop) {
                this.dismiss({ force: true });
                return;
            }
            new Toast($t(`%un`), $t(`%16`)).show();
        }
        catch (error) {
            this.errorBox = new ErrorBox(error);
        }
        this.retrying = false;
    }

    async poll() {
        if (this.polling) {
            return;
        }
        this.polling = true;

        try {
            if (this.$context && this.$context.user && this.$context.user.verified && this.$context.user.email === this.email) {
                // User is already verified, stop polling
                this.stopPolling();
                this.dismiss({ force: true });
                return;
            }
            console.error('playwright debug - poll email');
            const stop = await LoginHelper.pollEmail(this.$context, this.token);
            if (stop) {
                this.dismiss({ force: true });
                return;
            }
        }
        catch (e) {
            console.error(e);
        }
        this.pollCount++;
        this.polling = false;

        if (this.pollCount > 150) {
            // Stop after 12 minutes
            return;
        }

        this.timer = setTimeout(this.poll.bind(this), Math.max(this.pollCount * 1000, 5 * 1000));
    }

    async submit() {
        if (this.loading) {
            return;
        }

        // Send request
        this.loading = true;

        try {
            await LoginHelper.verifyEmail(this.$context, this.code, this.token);
            new Toast($t(`%uo`), 'success green').setHide(3000).show();

            // Yay!
            // we could be sign in, or couldn't.
            // if signed in: we'll automitically get deallocated
            // so always return
            this.dismiss({ force: true });
        }
        catch (e) {
            // Prevent closing now that we showed an error
            this.stopPolling();
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false;
    }

    async shouldNavigateAway() {
        return await CenteredMessage.confirm($t(`%up`), $t(`%uq`));
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
