<template>
    <form class="st-view login-view" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar title="Inloggen" />
        <main class="center small">
            <h1>Inloggen</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput ref="emailInput" v-model="email" :autofocus="true" enterkeyhint="next" class="max" name="username" title="E-mailadres" :validator="errors.validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="animating || lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <STInputBox title="Wachtwoord" class="max">
                <template #right>
                    <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                        <span>Vergeten</span>
                        <span class="icon help" />
                    </button>
                </template>
                <input v-model="password" enterkeyhint="go" class="input" name="current-password" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password" @input="(event) => password = event.target.value" @change="(event) => password = event.target.value">
            </STInputBox>

            <LoadingButton :loading="loading" class="block bottom">
                <button class="button primary full" type="submit">
                    <span class="lock icon" />
                    <span>Inloggen</span>
                </button>
            </LoadingButton>

            <hr>
            <p class="style-description-small">
                Of maak een nieuw account aan als je nog geen account hebt. Gebruik bij voorkeur een e-mailadres dat we al kennen.
            </p>

            <button class="button text selected" type="button" tabindex="-1" @click="openSignup">
                <span>Account aanmaken</span>
                <span class="icon arrow-right-small" />
            </button>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoutes, useDismiss, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking';
import { onMounted, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import EmailInput from '../inputs/EmailInput.vue';
import { useContext } from '../VueGlobalHelper';
import ConfirmEmailView from './ConfirmEmailView.vue';
import ForgotPasswordView from './ForgotPasswordView.vue';

const props = withDefaults(
    defineProps<{
        initialEmail: string
        lock: string | null
    }>(), {
        initialEmail: "",
        lock: null
    }
)

enum Routes {
    ForgotPassword = "forgotPassword",
    Signup = "signup"
}

defineRoutes([
    {
        name: Routes.ForgotPassword,
        url: 'wachtwoord-vergeten',
        component: ForgotPasswordView as any,
        paramsToProps() {
            return {
                initialEmail: email.value
            }
        },
    },
    {
        name: Routes.Signup,
        url: 'account-aanmaken',
        component: async () => (await import('./SignupView.vue')).default,
        paramsToProps() {
            return {
                initialEmail: email.value
            }
        },
    }
])

const errors = useErrors()
const $context = useContext();
const present = usePresent()
const dismiss = useDismiss()
const $navigate = useNavigate();

const loading = ref(false)
const email = ref(props.initialEmail)
const password = ref("");
const animating = ref(true)
const emailInput = ref<EmailInput | null>(null)

async function submit() {
    if (loading.value) {
        return
    }
 
    const valid = await errors.validator.validate()
 
    if (!valid) {
        return
    }
         
    if (email.value.length < 3 || password.value.length < 5) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: "empty_fields",
                message: "Je hebt geen correcte gegevens ingevuld"
            })
        )
        return;
    }
 
    loading.value = true
         
    try {
        const result = await LoginHelper.login($context.value, email.value, password.value)
 
        if (result.verificationToken) {
            await present({
                components: [
                    new ComponentWithProperties(ConfirmEmailView, { 
                        login: true, 
                        token: result.verificationToken, 
                        email: email.value
                    })
                ],
                modalDisplayStyle: "sheet"
            })
        } else {
            await dismiss({ force: true });
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function gotoPasswordForgot() {
    await $navigate(Routes.ForgotPassword)
}

async function openSignup() {
    await $navigate(Routes.Signup)
}

onMounted(() => {
    if (props.initialEmail.length == 0) {
        setTimeout(() => {
            animating.value = false;
            // Needed the any here because typescript is getting mad only in production mode
            if (emailInput.value) {
                emailInput.value.focus()
            }
        }, 300);
    } else {
        setTimeout(() => {
            // Needed the any here because typescript is getting mad only in production mode
            animating.value = false;
        }, 300);
    }
});
</script>
