<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                    <input v-model="name" class="input" nmae="name" type="text" autocomplete="name" :placeholder="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                </STInputBox>

                <STInputBox error-fields="title" :error-box="errors.errorBox" :title="$t(`7fe874c2-4d8c-45f8-8c84-c78422a55ab4`)+'*'">
                    <input v-model="contactTitle" list="emergency-contact-types" class="input" name="type" type="text" :placeholder="$t(`6f54efef-178e-4f56-9645-4cd4690cbe0f`)"><datalist id="emergency-contact-types">
                        <option v-if="details && details.parents.length === 0" value="Vader" />
                        <option v-if="details && details.parents.length === 0" value="Moeder" />
                        <option v-if="details && details.parents.length === 0" value="Ouder" />
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
                    *{{ $t('f3745dfa-564f-488a-a607-88239430be82') }}
                </p>
            </div>

            <div>
                <PhoneInput v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34')" :validator="errors.validator" :placeholder="$t('90d84282-3274-4d85-81cd-b2ae95429c34')" :required="true" />
            </div>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { EmergencyContact, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import { usePatch } from '../../../hooks';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import { CenteredMessage } from '../../../overlays/CenteredMessage';

const props = defineProps<{
    member: PlatformMember;
    emergencyContact: EmergencyContact;
    isNew: boolean;
}>();

const { patch, patched, addPatch, hasChanges } = usePatch(props.emergencyContact);
const details = computed(() => props.member.patchedMember.details);
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref($t(`Opslaan`));
const title = computed(() => !props.isNew ? `${patched.value.name || $t(`Noodcontactpersoon`)} bewerken` : $t(`Noodcontactpersoon toevoegen`));

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const contactTitle = computed({
    get: () => patched.value.title,
    set: title => addPatch({ title }),
});

const phone = computed({
    get: () => patched.value.phone,
    set: phone => addPatch({ phone }),
});

async function save() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    try {
        const se = new SimpleErrors();
        if (name.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`Vul de naam in`),
                field: 'name',
            }));
        }

        if (contactTitle.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`Vul een relatie in`),
                field: 'title',
            }));
        }

        if (!await errors.validator.validate()) {
            se.throwIfNotEmpty();
            loading.value = false;
            return;
        }
        se.throwIfNotEmpty();

        // Mark this parent as updated (not the same as reviewed, this helps merge duplicate parents correctly)
        addPatch({
            updatedAt: new Date(),
        });

        // Await patched.value to be updated
        await nextTick();

        if (props.isNew) {
            const minorMembers = props.member.family.members.filter(m => m.id !== props.member.id);

            if (minorMembers.length > 0 && !await CenteredMessage.confirm($t(`Wil je deze noodcontactpersoon bij alle gezinsleden toevoegen?`), $t(`Overal toevoegen`), $t(`Je kan deze noodcontactpersoon ook automatisch toevoegen bij`) + ' ' + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`en`) + ' ') + '.', $t(`Enkel hier`), false)) {
                props.member.addEmergencyContact(patched.value);
            }
            else {
                props.member.addEmergencyContact(patched.value);
                for (const member of minorMembers) {
                    member.addEmergencyContact(patched.value);
                }
            }
        }
        else {
            props.member.patchEmergencyContact(patch.value);
        }

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`Ben je zeker dat je wilt sluiten zonder op te slaan?`), $t(`Niet opslaan`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
