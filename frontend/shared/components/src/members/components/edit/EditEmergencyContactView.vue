<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
                    <input v-model="name" class="input" nmae="name" type="text" autocomplete="name" :placeholder="$t(`%Gq`)">
                </STInputBox>

                <STInputBox error-fields="title" :error-box="errors.errorBox" :title="$t(`%f5`)+'*'">
                    <input v-model="contactTitle" list="emergency-contact-types" class="input" name="type" type="text" :placeholder="$t(`%f6`)"><datalist id="emergency-contact-types">
                        <option v-if="details && details.parents.length === 0" :value="$t('%14s')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('%14t')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('%14u')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%14v')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%14w')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%14x')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%14y')" />
                        <option :value="$t('%f')" />
                        <option :value="$t('%Z')" />
                        <option :value="$t('%14z')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%150')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%i')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%h')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('%151')" />
                    </datalist>
                </STInputBox>
                <p class="style-description-small">
                    *{{ $t('%f4') }}
                </p>
            </div>

            <div>
                <PhoneInput v-model="phone" :title="$t('%2k')" :validator="errors.validator" :placeholder="$t('%2k')" :required="true" />
            </div>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import type { EmergencyContact, PlatformMember } from '@stamhoofd/structures';
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
const saveText = ref($t(`%v7`));
const title = computed(() => !props.isNew ? `${patched.value.name || $t(`%zw`)} bewerken` : $t(`%zx`));

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
                message: $t(`%zy`),
                field: 'name',
            }));
        }

        if (contactTitle.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`%zz`),
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

            if (minorMembers.length > 0 && !await CenteredMessage.confirm(
                $t(`%100`),
                $t(`%101`),
                $t(`%152`, { memberNames: Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`%M1`) + ' ') }),
                $t(`%zT`),
                false)
            ) {
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
