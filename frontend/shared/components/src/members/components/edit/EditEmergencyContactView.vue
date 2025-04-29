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
                        <option v-if="details && details.parents.length === 0" :value="$t('Vader')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('Moeder')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('Ouder')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Oma')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Opa')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Tante')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Oom')" />
                        <option :value="$t('Buurvrouw')" />
                        <option :value="$t('Buurman')" />
                        <option :value="$t('Vriend')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Nonkel')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Pepe')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Meme')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('Grootvader')" />
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
const saveText = ref($t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`));
const title = computed(() => !props.isNew ? `${patched.value.name || $t(`757f4504-e8c3-4188-a471-0d5a88c353ea`)} bewerken` : $t(`e01a065d-e946-4fe8-99bc-505c33b055f0`));

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
                message: $t(`8edc8d31-c902-437c-8f0d-c4afbe52871c`),
                field: 'name',
            }));
        }

        if (contactTitle.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`2c3431a2-2a81-45ff-81d0-822e8fc31060`),
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

            if (minorMembers.length > 0 && !await CenteredMessage.confirm($t(`7e6694ee-7a21-41a3-8df0-dc9e0df35b2f`), $t(`290ab18c-dc62-4d85-a669-dd83c77758e7`), $t(`0e7e79db-62f1-4be9-9464-1552fa6c1216`) + ' ' + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + '.', $t(`fe636d8c-6506-4c8b-bb79-9c20fb1bc54d`), false)) {
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
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
