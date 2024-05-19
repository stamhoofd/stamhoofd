<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
                    <input v-model="name" class="input" nmae="name" type="text" placeholder="Naam" autocomplete="name">
                </STInputBox>

                <STInputBox title="Relatie*" error-fields="title" :error-box="errors.errorBox">
                    <input v-model="contactTitle" list="emergency-contact-types" class="input" name="type" type="text" placeholder="Bv. buurman">
                    <datalist id="emergency-contact-types">
                        <option v-if="details && details.parents.length == 0" value="Vader" />
                        <option v-if="details && details.parents.length == 0" value="Moeder" />
                        <option v-if="details && details.parents.length == 0" value="Ouder" />
                        <option v-if="details && details.defaultAge < 30" value="Oma" />
                        <option v-if="details && details.defaultAge < 30" value="Opa" />
                        <option v-if="details && details.defaultAge < 30" value="Tante" />
                        <option v-if="details && details.defaultAge < 30" value="Oom" />
                        <option value="Buurvrouw" />
                        <option value="Buurman" />
                        <option value="Vriend" />
                        <option v-if="details && details.defaultAge < 30" value="Nonkel" />
                        <option v-if="details && details.defaultAge < 30" value="Pepe" />
                        <option v-if="details && details.defaultAge < 30" value="Meme" />
                        <option v-if="details && details.defaultAge < 30" value="Grootvader" />
                        <option v-if="details && details.defaultAge < 30" value="Grootmoeder" />
                    </datalist>
                </STInputBox>
                <p class="style-description-small">
                    *Vul gelijk welke benaming in met het toetsenbord of kies één uit de lijst.
                </p>
            </div>

            <div>
                <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="errors.validator" :placeholder="$t('shared.inputs.mobile.label')" :required="true" />
            </div>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { EmergencyContact, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { usePatch } from '../../../hooks';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import { CenteredMessage } from '../../../overlays/CenteredMessage';

const props = defineProps<{
    member: PlatformMember,
    emergencyContact: EmergencyContact,
    isNew: boolean
}>();

const {patched, addPatch, hasChanges} = usePatch(props.emergencyContact);
const details = computed(() => props.member.patchedMember.details)
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref("Opslaan");
const title = computed(() => !props.isNew ? `${patched.value.name || 'Noodcontactpersoon'} bewerken` : "Noodcontactpersoon toevoegen");

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
});

const contactTitle = computed({
    get: () => patched.value.title,
    set: (title) => addPatch({title})
});

const phone = computed({
    get: () => patched.value.phone,
    set: (phone) => addPatch({phone})
});

async function save() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    try {
        const se = new SimpleErrors()
        if (name.value.length < 2) {
            se.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de naam in",
                field: "name"
            }))
        }

        if (!await errors.validator.validate()) {
            se.throwIfNotEmpty()
            loading.value = false;
            return;
        }
        se.throwIfNotEmpty()

        if (props.isNew) {
            const minorMembers = props.member.family.members.filter(m => m.id !== props.member.id)

            if (minorMembers.length > 0 && !await CenteredMessage.confirm("Wil je deze noodcontactpersoon bij alle gezinsleden toevoegen?", "Overal toevoegen", "Je kan deze noodcontactpersoon ook automatisch toevoegen bij " + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' en ')+'.', 'Enkel hier', false)) {
                props.member.addEmergencyContact(patched.value)
            } else {
                props.member.addEmergencyContact(patched.value)
                for (const member of minorMembers) {
                    member.addEmergencyContact(patched.value)
                }
            }
        } else {
            props.member.family.updateEmergencyContact(patched.value)
        }

        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})

</script>

