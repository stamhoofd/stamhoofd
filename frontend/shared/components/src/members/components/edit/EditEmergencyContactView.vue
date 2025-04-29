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
                        <option v-if="details && details.parents.length === 0" :value="$t('5fcbcd43-cfec-4968-84b2-6efc406609bf')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('56abd9d2-307e-486a-8a85-753c508af11d')" />
                        <option v-if="details && details.parents.length === 0" :value="$t('1db644a2-8fc8-4471-b7ef-544ac1a82f60')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('bc68e8f0-2911-42d3-afca-790ed9a5fa35')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('9e41e85d-7135-4b27-a9d0-f55f11c0f51c')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('d1ec5f91-44e9-49db-8337-22dfab2440b7')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('14fdbd04-a37b-4e57-9be7-b0892511d0e0')" />
                        <option :value="$t('4402e10d-4229-492a-b7f7-fcf2a49af08d')" />
                        <option :value="$t('30130aed-32dd-446f-bb35-9dfa71ee37aa')" />
                        <option :value="$t('9d618b2e-49dd-4930-9f0b-73c19d7ca168')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('ca5b258d-935e-4744-b9db-e736ea1b0960')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('9a5c69e1-978a-40f4-996f-2ccfbdaa60de')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('6f401bac-7593-4220-8c85-b7d829c39673')" />
                        <option v-if="details && details.defaultAge < 30" :value="$t('06fb5ba2-2838-4cb9-afd6-9a51485d9c90')" />
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

            if (minorMembers.length > 0 && !await CenteredMessage.confirm(
                $t(`7e6694ee-7a21-41a3-8df0-dc9e0df35b2f`),
                $t(`290ab18c-dc62-4d85-a669-dd83c77758e7`),
                $t(`7b66774f-4b96-4407-aff5-54b60d7a36bc`, { memberNames: Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') }),
                $t(`fe636d8c-6506-4c8b-bb79-9c20fb1bc54d`),
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
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
