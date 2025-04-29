<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)">
                    <Dropdown v-model="type">
                        <option v-for="t in parentTypes" :key="t" :value="t">
                            {{ formatParentType(t) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                        </div>
                    </div>
                </STInputBox>

                <PhoneInput v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34')" :validator="errors.validator" :placeholder="$t('7f30db7e-4851-4aa6-b731-2c898054f707')" :required="app === 'registration'" />

                <EmailInput v-model="email" :required="app === 'registration'" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`) " :validator="errors.validator" :placeholder="$t(`80e0424d-40a8-4ce8-94e4-2e0394d6f39c`)">
                    <template #right>
                        <button :v-tooltip="$t('2797d590-7e74-4852-84aa-076f7919a2fb')" class="button icon add gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`d11ec0de-3c33-46be-b5fb-09f9e3a9101e`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :validator="errors.validator" :placeholder="$t(`80e0424d-40a8-4ce8-94e4-2e0394d6f39c`)" @update:model-value="setEmail(n - 1, $event)">
                    <template #right>
                        <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>

                <p v-if="email && member && app !== 'registration'" class="style-description-small">
                    {{ $t('189115ef-fb2c-4b15-a2d9-514aaf8a08ae') }} <template v-if="alternativeEmails.length">
                        {{ $t('4471042e-ccb1-4059-b39c-7302444c3690') }}
                    </template><template v-else>
                        {{ $t('f90bed26-2790-49b7-9e77-e02518022ee5') }}
                    </template> {{ $t('281341bb-32fb-4683-8c22-20264fbde679', {member: member.patchedMember.firstName}) }}
                </p>
                <p v-else-if="firstName && email && member" class="style-description-small">
                    {{ firstName }} {{ $t('a188581c-4112-42e4-982a-6c57d4af5c74') }} <template v-if="alternativeEmails.length">
                        {{ $t('4471042e-ccb1-4059-b39c-7302444c3690') }}
                    </template><template v-else>
                        {{ $t('f90bed26-2790-49b7-9e77-e02518022ee5') }}
                    </template> {{ $t('281341bb-32fb-4683-8c22-20264fbde679', {member: member.patchedMember.firstName}) }}
                </p>

                <p v-if="alternativeEmails.length && member" class="style-description-small">
                    <template v-if="app !== 'registration'">
                        {{ $t('eca0a260-096c-413a-9fa0-0c91acd9c780') }}
                    </template>
                    <template v-else>
                        {{ firstName }} {{ $t('16f55ca0-6a64-44e0-bcd5-bf5e9df61473') }}
                    </template>
                </p>

                <template v-if="(isPropertyEnabled('parents.nationalRegisterNumber') || nationalRegisterNumber)">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`439176a5-dd35-476b-8c65-3216560cac2f`)" :required="isNRNRequiredForThisParent" :nullable="true" :validator="errors.validator" />
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        {{ $t('cb5c9f59-30ae-470a-ab94-ed33b111850c') }} <template v-if="isPropertyRequired('parents.nationalRegisterNumber')">
                            {{ $t('c78ae112-296b-4b37-899b-8e3f56729079') }}
                        </template> {{ $t('b059530c-5267-49a7-b2ee-c7ae33f0c573', {name: firstName || 'deze ouder'}) }} <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                            {{ $t('db9b9618-9f98-4b43-9619-4db64c0d7e68') }}
                        </button>.
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('c6b0d0d0-ec52-4716-92b1-db4473b4d6e9') }} <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                            {{ $t('db9b9618-9f98-4b43-9619-4db64c0d7e68') }}
                        </button>.
                    </p>
                </template>
            </div>

            <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="errors.validator" :required="app === 'registration'" />
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { Address, NationalRegisterNumberOptOut, Parent, ParentType, ParentTypeHelper, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';
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
const { patched, addPatch, hasChanges, patch } = usePatch(props.parent);
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref($t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`));
const app = useAppContext();
const parentTypes = ParentTypeHelper.getPublicTypes();
const title = computed(() => !props.isNew ? `${patched.value.firstName || $t(`92a1d590-2388-4193-9fac-ad41b6122fe4`)} bewerken` : $t(`eb1bf015-9263-4f25-a7e4-f57b07342fb8`));
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
                message: $t(`7764f616-f742-4704-93ff-22f1dd31f830`),
                field: 'firstName',
            }));
        }
        if (lastName.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`bc27bb72-c06d-4a05-8e22-e920d01cc1f4`),
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
                            message: $t(`Dit rijksregisternummer werd al ingevuld bij {firstName}. Vul a.u.b. het juiste rijksregisternummer in, dit kan invloed hebben op uw belastingaangifte.`, {firstName: member.patchedMember.firstName}),
                            field: 'nationalRegisterNumber',
                        }));
                    }
                }
            }

            const parent = otherParents.find(p => p.nationalRegisterNumber === nationalRegisterNumber.value);
            if (parent) {
                se.addError(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`Dit rijksregisternummer wordt al gebruikt door een andere ouder ({name}). Vul a.u.b. het juiste rijksregisternummer in, dit kan invloed hebben op uw belastingaangifte.`, {name: parent.name}),
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

        // Mark this parent as updated (not the same as reviewed, this helps merge duplicate parents correctly)
        addPatch({
            updatedAt: new Date(),
        });

        // Await patched.value to be updated
        await nextTick();

        if (props.member && props.isNew) {
            const minorMembers = family.members.filter(m => m.id !== props.member!.id && m.isPropertyEnabled('parents'));

            if (minorMembers.length > 0 && !await CenteredMessage.confirm($t(`27091cc2-c42d-457d-8250-05abc7d4937d`), $t(`290ab18c-dc62-4d85-a669-dd83c77758e7`), $t(`81d1f71d-0656-4086-bfd1-de54cd540678`) + ' ' + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + '.', $t(`fe636d8c-6506-4c8b-bb79-9c20fb1bc54d`), false)) {
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
            if (props.member) {
                props.member.patchParent(patch.value);
            }
            else if (props.family) {
                props.family.patchParent(patch.value);
            }
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

    if (!await CenteredMessage.confirm(
        $t(`14a6da51-a82f-43b5-9e6a-2d679985d41a`), 
        $t(`4d5e0d3f-688a-4c8b-bad7-818d976166bf`), 
        $t(`{from} is ook het adres van {names}. Als je wilt kan je het adres ook daar wijzigen naar {to}.`, {from: from.shortString(), to: to.shortString(), names: Formatter.joinLast(occurrences, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') }),
        $t(`fe636d8c-6506-4c8b-bb79-9c20fb1bc54d`), 
        false)
    ) {
        return;
    }

    family.updateAddress(from, to);
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
