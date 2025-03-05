<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`04043e8a-6a58-488e-b538-fea133738532`)">
                    <Dropdown v-model="type">
                        <option v-for="t in parentTypes" :key="t" :value="t">
                            {{ formatParentType(t) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
                    </div>
                </STInputBox>

                <PhoneInput v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34')" :validator="errors.validator" :placeholder="$t('7f30db7e-4851-4aa6-b731-2c898054f707')" :required="app === 'registration'"/>

                <EmailInput v-model="email" :required="app === 'registration'" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`) " :validator="errors.validator" :placeholder="$t(`8e30c7ef-2780-4433-b194-963fe24bb8c8`)">
                    <template #right>
                        <button v-tooltip="'Alternatief e-mailadres toevoegen'" class="button icon add gray" type="button" @click="addEmail"/>
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`bfb03263-25f0-41d6-a68d-8946a3a5dd8a`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :validator="errors.validator" @update:model-value="setEmail(n - 1, $event)" :placeholder="$t(`8e30c7ef-2780-4433-b194-963fe24bb8c8`)">
                    <template #right>
                        <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)"/>
                    </template>
                </EmailInput>

                <p v-if="email && member && member.patchedMember.details.parentsHaveAccess && app !== 'registration'" class="style-description-small">
                    {{ $t('b677a5cb-9029-4604-8d15-2a666f1803e9') }} <template v-if="alternativeEmails.length">
                        {{ $t('3c5deb93-94f1-4104-b690-d805813157e0') }}
                    </template><template v-else>
                        {{ $t('652bf35d-8557-42a8-8307-df3c640346cc') }}
                    </template> {{ $t('240e4f2b-685b-4bb1-bde4-73f2c8f17bbc') }} {{ member.patchedMember.firstName }} {{ $t('0c8e0d14-2c0d-44ed-ae64-500b5897ffeb') }}
                </p>
                <p v-else-if="firstName && email && member && member.patchedMember.details.parentsHaveAccess" class="style-description-small">
                    {{ firstName }} {{ $t('10d395dc-0975-4a4a-8fa8-37fd53bf749f') }} <template v-if="alternativeEmails.length">
                        {{ $t('3c5deb93-94f1-4104-b690-d805813157e0') }}
                    </template><template v-else>
                        {{ $t('652bf35d-8557-42a8-8307-df3c640346cc') }}
                    </template> {{ $t('240e4f2b-685b-4bb1-bde4-73f2c8f17bbc') }} {{ member.patchedMember.firstName }} {{ $t('0c8e0d14-2c0d-44ed-ae64-500b5897ffeb') }}
                </p>

                <p v-if="alternativeEmails.length && member && member.patchedMember.details.parentsHaveAccess" class="style-description-small">
                    <template v-if="app !== 'registration'">
                        {{ $t('0cc70fe1-6288-4a96-a4cf-3bb6c54d3f61') }}
                    </template>
                    <template v-else>
                        {{ firstName }} {{ $t('845f7455-7d78-42c2-a4ab-71cfc562c8af') }}
                    </template>
                </p>

                <template v-if="(isPropertyEnabled('parents.nationalRegisterNumber') || nationalRegisterNumber)">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`642e4034-71e5-4d00-a6f4-b7dbcc39aac0`)" :required="isNRNRequiredForThisParent" :nullable="true" :validator="errors.validator"/>
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        {{ $t('0db38003-5407-4a39-84f3-d0d918afc2d2') }} <template v-if="isPropertyRequired('parents.nationalRegisterNumber')">
                            {{ $t('b12e346f-0928-4f98-8586-c983c0a17568') }}
                        </template> {{ $t('d4b0ef8c-5ffe-40f1-bc27-e2ff608f5474') }} {{ firstName || 'deze ouder' }} {{ $t('db74359d-7094-4e58-ac75-22f3bf318763') }} <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                            {{ $t('0af2c851-cf7e-4821-8e18-386150f9b7a8') }}
                        </button>.
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('d8e665a4-2cc3-4787-a83c-6c232bb269c5') }} <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                            {{ $t('0af2c851-cf7e-4821-8e18-386150f9b7a8') }}
                        </button>.
                    </p>
                </template>
            </div>

            <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="errors.validator" :required="app === 'registration'"/>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { Address, Country, NationalRegisterNumberOptOut, Parent, ParentType, ParentTypeHelper, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import { usePatch } from '../../../hooks';
import Dropdown from '../../../inputs/Dropdown.vue';
import EmailInput from '../../../inputs/EmailInput.vue';
import NRNInput from '../../../inputs/NRNInput.vue';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import SelectionAddressInput from '../../../inputs/SelectionAddressInput.vue';
import { CenteredMessage } from '../../../overlays/CenteredMessage';
import { NavigationActions, useNavigationActions } from '../../../types/NavigationActions';
import { useIsAllOptional, useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks';

const props = withDefaults(defineProps<{
    member?: PlatformMember | null;
    family?: PlatformFamily | null;
    parent: Parent;
    isNew: boolean;
    saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
}>(), {
    member: null,
    family: null,
    saveHandler: null,
});

const family = props.family || props.member!.family;
const { patched, addPatch, hasChanges } = usePatch(props.parent);
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref('Opslaan');
const app = useAppContext();
const parentTypes = ParentTypeHelper.getPublicTypes();
const title = computed(() => !props.isNew ? `${patched.value.firstName || 'Ouder'} bewerken` : 'Ouder toevoegen');
const navigate = useNavigationActions();

const relatedMembers = computed(() => {
    const base = family.getMembersForParent(props.parent);

    if (props.member && !base.find(m => m.id === props.member?.id)) {
        base.push(props.member);
    }
    return base;
});

const isPropertyRequired = useIsPropertyRequired(relatedMembers);
const isPropertyEnabled = useIsPropertyEnabled(relatedMembers, true);
const isAllOptional = useIsAllOptional(relatedMembers);

/**
 * If NRN is required, it is only required for one parent of each member
 */
const isNRNRequiredForThisParent = computed(() => {
    if (isAllOptional.value) {
        return false;
    }

    for (const member of relatedMembers.value) {
        const required = member.isPropertyRequired('parents.nationalRegisterNumber');
        if (required && !member.patchedMember.details.parents.find(p => p.id !== props.parent.id && !!p.nationalRegisterNumber)) {
            return true;
        }
    }
    return false;
});

const firstName = computed({
    get: () => patched.value.firstName,
    set: firstName => addPatch({ firstName }),
});

const lastName = computed({
    get: () => patched.value.lastName,
    set: lastName => addPatch({ lastName }),
});

const type = computed({
    get: () => patched.value.type,
    set: type => addPatch({ type }),
});

const phone = computed({
    get: () => patched.value.phone,
    set: phone => addPatch({ phone }),
});

const email = computed({
    get: () => patched.value.email,
    set: email => addPatch({ email }),
});

const address = computed({
    get: () => patched.value.address,
    set: address => addPatch({ address }),
});

const alternativeEmails = computed({
    get: () => patched.value.alternativeEmails,
    set: alternativeEmails => addPatch({
        alternativeEmails: alternativeEmails as any,
    }),
});

const nationalRegisterNumber = computed({
    get: () => patched.value.nationalRegisterNumber,
    set: nationalRegisterNumber => addPatch({ nationalRegisterNumber }),
});

const availableAddresses = computed(() => {
    const list = family.addresses;

    return list;
});

function deleteEmail(n: number) {
    const newEmails = [...alternativeEmails.value];
    newEmails.splice(n, 1);
    alternativeEmails.value = newEmails;
}

function addEmail() {
    alternativeEmails.value = [...alternativeEmails.value, ''];
}

function getEmail(index: number) {
    return alternativeEmails.value[index] ?? '';
}

function setEmail(index: number, value: string) {
    const newEmails = [...alternativeEmails.value];
    newEmails[index] = value;
    alternativeEmails.value = newEmails;
}

function formatParentType(type: ParentType) {
    return ParentTypeHelper.getName(type);
}

async function save() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    try {
        const se = new SimpleErrors();
        if (firstName.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: 'Vul de voornaam in',
                field: 'firstName',
            }));
        }
        if (lastName.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: 'Vul de achternaam in',
                field: 'lastName',
            }));
        }

        if (nationalRegisterNumber.value && nationalRegisterNumber.value !== NationalRegisterNumberOptOut) {
            const otherParents = family.parents.filter(p => p.id !== props.parent.id && !p.isEqual(patched.value));

            if (relatedMembers.value) {
                for (const member of relatedMembers.value) {
                    if (member.patchedMember.details.nationalRegisterNumber === nationalRegisterNumber.value) {
                        se.addError(new SimpleError({
                            code: 'invalid_field',
                            message: 'Dit rijksregisternummer is al in gebruik door ' + member.patchedMember.firstName + '. Vul a.u.b. het juiste rijksregisternummer in, dit kan invloed hebben op uw belastingaangifte.',
                            field: 'nationalRegisterNumber',
                        }));
                    }
                }
            }

            const parent = otherParents.find(p => p.nationalRegisterNumber === nationalRegisterNumber.value);
            if (parent) {
                se.addError(new SimpleError({
                    code: 'invalid_field',
                    message: `Dit rijksregisternummer is al in gebruik door een andere ouder (${parent.name}). Vul a.u.b. het juiste rijksregisternummer in, dit kan invloed hebben op uw belastingaangifte.`,
                    field: 'nationalRegisterNumber',
                }));
            }
        }

        if (!await errors.validator.validate()) {
            se.throwIfNotEmpty();
            loading.value = false;
            return;
        }
        se.throwIfNotEmpty();

        const old = props.parent.address;
        const updated = patched.value.address;

        if (old !== null && updated !== null && old.toString() !== updated.toString()) {
            await modifyAddress(old, updated);
        }

        if (props.member && props.isNew) {
            const minorMembers = family.members.filter(m => m.id !== props.member!.id && m.isPropertyEnabled('parents'));

            if (minorMembers.length > 0 && !await CenteredMessage.confirm('Wil je deze ouder bij alle gezinsleden toevoegen?', 'Overal toevoegen', 'Je kan deze ouder ook automatisch toevoegen bij ' + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' en ') + '.', 'Enkel hier', false)) {
                props.member.addParent(patched.value);
            }
            else {
                props.member.addParent(patched.value);
                for (const member of minorMembers) {
                    member.addParent(patched.value);
                }
            }
        }
        else {
            family.updateParent(patched.value);
        }

        if (props.saveHandler) {
            await props.saveHandler(navigate);
        }
        else {
            await pop({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function modifyAddress(from: Address, to: Address) {
    // todo: Check if we find this address in other places...
    const occurrences = family.getAddressOccurrences(from, { parentId: patched.value.id });

    if (occurrences.length === 0) {
        return;
    }

    if (!await CenteredMessage.confirm('Wil je dit adres overal wijzigen?', 'Overal wijzigen', from.shortString() + ' is ook het adres van ' + Formatter.joinLast(occurrences, ', ', ' en ') + '. Als je wilt kan je het adres ook voor hen wijzigen naar ' + to.shortString() + '.', 'Enkel hier', false)) {
        return;
    }

    family.updateAddress(from, to);
}

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});

</script>
