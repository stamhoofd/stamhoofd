<template>
    <STErrorsDefault :error-box="errors.errorBox" />

    <Checkbox v-for="policy of requiredPolicies" :key="policy.id" :model-value="isAccepted(policy)" class="long-text" @update:model-value="setAccepted(policy, $event)">
        <div v-if="policy.richText.html" class="style-wysiwyg" v-html="policy.richText.html" /><span v-else>{{ policy.name }}</span>
    </Checkbox>
    
    <footer class="signup-policies-footer">
        <slot />
    </footer>

    <div v-if="policies.filter(p => !p.checkbox).length > 0" class="signup-policy-footer-suffix">
        <p v-for="policy of policies.filter(p => !p.checkbox)" :key="policy.id" class="style-description-block">
            <span v-if="policy.richText.html" class="style-wysiwyg gray" v-html="policy.richText.html" />
            <span v-else>{{ policy.name }}</span>
        </p>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from "@simonbackx/simple-errors";
import { PlatformPolicy, RichText } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { computed, ref } from "vue";
import { ErrorBox } from "../../errors/ErrorBox";
import { Validator } from "../../errors/Validator";
import { useErrors } from "../../errors/useErrors";
import { useValidation } from "../../errors/useValidation";
import { useOrganization, usePlatform } from "../../hooks";

const props = defineProps<{
    validator: Validator
}>()

const acceptPrivacy = ref(new Set<string>())
const organization = useOrganization()
const platform = usePlatform()
const errors = useErrors()

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

useValidation(props.validator, () => {
    for (const policy of requiredPolicies.value) {
        if (!isAccepted(policy)) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: "read_privacy",
                message: "Je moet akkoord gaan met de voorwaarden voor je een account kan aanmaken."
            }))
            return false;
        }
    }
    errors.errorBox = null;
    return true
})

</script>

<style lang="scss">
.signup-policy-footer-suffix {
    padding-top: 15px;
}

.signup-policy-footer {
    padding-top: 15px;
}
</style>
