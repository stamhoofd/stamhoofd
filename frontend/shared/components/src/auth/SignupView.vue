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

            <Checkbox v-for="policy of requiredPolicies" :key="policy.id" :model-value="isAccepted(policy)" class="long-text" @update:model-value="setAccepted(policy, $event)">
                <div v-if="policy.richText.html" class="style-wysiwyg" v-html="policy.richText.html" /><span v-else>{{ policy.name }}</span>
            </Checkbox>

            <footer class="signup-footer">
                <LoadingButton :loading="loading" class="block input-spacing">
                    <button id="submit" class="button primary" type="submit">
                        <span class="icon lock" />
                        <span>Account aanmaken</span>
                    </button>
                </LoadingButton>
            </footer>
            
            <div v-if="policies.filter(p => !p.checkbox).length > 0" class="policy-footer">
                <p v-for="policy of policies.filter(p => !p.checkbox)" :key="policy.id" class="style-description-block">
                    <span v-if="policy.richText.html" class="style-wysiwyg gray" v-html="policy.richText.html" />
                    <span v-else>{{ policy.name }}</span>
                </p>
            </div>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking';
import { computed, ref } from 'vue';

import { PlatformPolicy, RichText } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext, useOrganization, usePlatform } from '../hooks';
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
const platform = usePlatform()
const $context = useContext();
const show = useShow()

const email = ref(props.initialEmail)
const password = ref("")
const passwordRepeat = ref("")
const acceptPrivacy = ref(new Set<string>())
const loading = ref(false)

const policies = computed(() =>{
    if (STAMHOOFD.userMode === 'organization') {
        if (!organization.value) {
            return []
        }

        const url = organization.value.meta.privacyPolicyUrl || organization.value.meta.privacyPolicyFile?.getPublicPath() || ''

        return [
            PlatformPolicy.create({
                name: "Privacybeleid",
                url,
                checkbox: true,
                richText: RichText.create({
                    html: 'Ik ga akkoord met <a href="'+Formatter.escapeHtml(url)+'" target="_blank">het privacybeleid</a>.'
                })
            })
        ]
    }
    return platform.value.config.privacy.policies.filter(p => p.enableAtSignup)
});

const requiredPolicies = computed(() => policies.value.filter(p => p.checkbox))

function isAccepted(policy: PlatformPolicy) {
    return acceptPrivacy.value.has(policy.id)
}

function setAccepted(policy: PlatformPolicy, value: boolean) {
    if (value) {
        acceptPrivacy.value.add(policy.id)
    } else {
        acceptPrivacy.value.delete(policy.id)
    }
}

async function submit() {
    if (loading.value) {
        return
    }  
 
    const valid = await errors.validator.validate()

    for (const policy of requiredPolicies.value) {
        if (!isAccepted(policy)) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: "read_privacy",
                message: "Je moet akkoord gaan met de voorwaarden voor je een account kan aanmaken."
            }))
            return;
        }
    }

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

<style lang="scss">
.signup-view {
    .policy-footer {
        padding-top: 15px;
    }

    footer {
        padding-top: 15px;
    }
}

</style>
