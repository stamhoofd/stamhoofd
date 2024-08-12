<template>
    <form class="signup-view st-view" @submit.prevent="submit">
        <STNavigationBar title="Account aanmaken" />

        <main class="center">
            <h1>Account aanmaken</h1>
            <p v-if="!lock">
                Gebruik bij voorkeur een e-mailadres waarnaar we je al e-mails sturen.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="true" title="Persoonlijk e-mailadres" name="username" :validator="errors.validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Kies een wachtwoord">
                        <input id="new-password" v-model="password" name="new-password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="(event) => password = event.target.value" @change="(event) => password = event.target.value">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input id="confirm-password" v-model="passwordRepeat" name="confirm-password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="(event) => passwordRepeat = event.target.value" @change="(event) => passwordRepeat = event.target.value">
                    </STInputBox>
                </div>
                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>

            <Checkbox v-if="privacyUrl" v-model="acceptPrivacy" class="long-text">
                Ik heb kennis genomen van <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
            </Checkbox>

            <footer>
                <LoadingButton :loading="loading" class="block input-spacing">
                    <button id="submit" class="button primary" type="submit">
                        <span class="icon lock" />
                        <span>Account aanmaken</span>
                    </button>
                </LoadingButton>
            </footer>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking';
import { computed, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext, useOrganization } from '../hooks';
import EmailInput from '../inputs/EmailInput.vue';
import PasswordStrength from '../inputs/PasswordStrength.vue';
import ConfirmEmailView from './ConfirmEmailView.vue';

const props = withDefaults(
    defineProps<{
        initialEmail?: string
        lock?: string | null
    }>(), {
        initialEmail: "",
        lock: null
    }
)

const errors = useErrors()
const organization = useOrganization()
const $context = useContext();
const show = useShow()

const email = ref(props.initialEmail)
const password = ref("")
const passwordRepeat = ref("")
const acceptPrivacy = ref(false)
const loading = ref(false)

const privacyUrl = computed(() => {
    if (!organization.value) {
        return null
    }
    if (organization.value.meta.privacyPolicyUrl) {
        return organization.value.meta.privacyPolicyUrl
    }
    if (organization.value.meta.privacyPolicyFile) {
        return organization.value.meta.privacyPolicyFile.getPublicPath()
    }
    return null
})

async function submit() {
    if (loading.value) {
        return
    }  
 
    const valid = await errors.validator.validate()
 
    if (password.value != passwordRepeat.value) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: "password_mismatch",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            })
        )
        return;
    }
 
    if (password.value.length < 8) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: "password_too_short",
            message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan."
        }))
        return;
    }
 
    if (!acceptPrivacy.value && !!privacyUrl.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: "read_privacy",
            message: "Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken."
        }))
        return;
    }
 
    if (!valid) {
        errors.errorBox = null
        return;
    }
 
    loading.value = true;     
    errors.errorBox = null
         
    try {
        const token = await LoginHelper.signUp($context.value, email.value, password.value)
        loading.value = false;
        await show({
            components: [
                new ComponentWithProperties(ConfirmEmailView, { 
                    token, 
                    email: email.value 
                })
            ]
        })
        return
             
    } catch (e) {
        loading.value = false;
        errors.errorBox = new ErrorBox(e)
    }
}
</script>
