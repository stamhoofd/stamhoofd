<template>
    <form class="confirm-email-view st-view small" @submit.prevent="submit">
        <STNavigationBar>
            <template #right>
                <LoadingButton :loading="retrying">
                    <button class="button text" type="button" @click="retry">
                        <span class="icon retry" />
                        <span>{{ $t('7889a8f8-a31e-4291-b8e7-6169e68ed6b4') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STNavigationBar>
        <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration"><main class="center">
            <h1 v-if="!login">
                {{ $t('5cb65126-68af-4cdc-8ecf-836471dbd536') }}
            </h1>
            <h1 v-else>
                {{ $t('0169b51e-08fb-43b0-a161-01d65335a297') }}
            </h1>

            <p>{{ $t("58c24560-069c-4c85-a879-fe00c534bf14", {email}) }}</p>

            <div><CodeInput v-model="code" @complete="submit" /></div>

            <div><STErrorsDefault :error-box="errorBox" /></div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary full" type="button">
                        <span>{{ $t('c72a9ab2-98a0-4176-ba9b-86fe009fa755') }}</span>
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
import { CenteredMessage, Checkbox, CodeInput, EmailInput, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, STToolbar, Toast } from '@stamhoofd/components';
import { LoginHelper } from '@stamhoofd/networking';

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
        console.error('playwright debug - confirm email mounted');
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
            new Toast($t(`73466f92-bfc1-4fd8-9de7-363738ac6dd7`), 'error red').show();
            return;
        }
        // TODO
        if (!await CenteredMessage.confirm($t(`6e55c6ff-8487-4376-8804-1b3934623146`), $t(`776a9bda-a078-4fe8-afa8-3285b5f5c794`), $t(`f8a74bb1-0df6-4313-875d-ac4b0ba3b36c`))) {
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
            new Toast($t(`cc0f2b34-b2c3-4df1-871d-17ad969205c5`), $t(`6df6c342-d948-41b1-b913-55cfd3c2b558`)).show();
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
                console.error('playwright debug - user already verified, stop polling');
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
            new Toast($t(`a66456db-d4d8-4f4e-895e-e66aa873604a`), 'success green').setHide(3000).show();

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
        return await CenteredMessage.confirm($t(`91ac3f67-da37-4366-9392-d07148e5557f`), $t(`078baf81-049b-4f3f-9ccb-8ab39b8ddaf8`));
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
