<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`%vC`)">
                    <Dropdown v-model="type">
                        <option v-for="t in parentTypes" :key="t" :value="t">
                            {{ formatParentType(t) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%1Os`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                        </div>
                    </div>
                </STInputBox>

                <PhoneInput v-model="phone" :title="$t('%2k')" :validator="errors.validator" :placeholder="$t('%2j')" :required="app === 'registration'" />

                <EmailInput v-model="email" :required="app === 'registration'" :title="$t(`%1FK`) " :validator="errors.validator" :placeholder="$t(`%fc`)">
                    <template #right>
                        <button :v-tooltip="$t('%fI')" class="button icon add gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`%fR`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :validator="errors.validator" :placeholder="$t(`%fc`)" @update:model-value="setEmail(n - 1, $event)">
                    <template #right>
                        <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>

                <p v-if="email && member && app !== 'registration'" class="style-description-small">
                    <template v-if="alternativeEmails.length">
                        {{ $t('%15O', {firstName: member.patchedMember.firstName}) }}
                    </template><template v-else>
                        {{ $t('%15P', {firstName: member.patchedMember.firstName}) }}
                    </template>
                </p>
                <p v-else-if="firstName && email && member" class="style-description-small">
                    <template v-if="alternativeEmails.length">
                        {{ $t('%15Q', {firstName: member.patchedMember.firstName}) }}
                    </template><template v-else>
                        {{ $t('%15R', {firstName: member.patchedMember.firstName}) }}
                    </template>
                </p>

                <p v-if="alternativeEmails.length && member" class="style-description-small">
                    <template v-if="app !== 'registration'">
                        {{ $t('%fZ') }}
                    </template>
                    <template v-else>
                        {{ $t('%15S', {firstName}) }}
                    </template>
                </p>

                <template v-if="(isPropertyEnabled('parents.nationalRegisterNumber') || nationalRegisterNumber)">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`%wK`)" :required="isNRNRequiredForThisParent" :nullable="true" :validator="errors.validator" />
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        {{ $t('%fa') }} <template v-if="isPropertyRequired('parents.nationalRegisterNumber')">
                            {{ $t('%fb') }}
                        </template>
                        <I18nComponent :t="$t('%15T', {name: firstName || $t('%15U')})">
                            <template #button="{content}">
                                <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                                    {{ content }}
                                </button>
                            </template>
                        </I18nComponent>
                    </p>
                    <p v-else class="style-description-small">
                        <I18nComponent :t="$t('%15N')">
                            <template #button="{content}">
                                <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                                    {{ content }}
                                </button>
                            </template>
                        </I18nComponent>
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
import type { Address, Parent, ParentType, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { NationalRegisterNumberOptOut, ParentTypeHelper } from '@stamhoofd/structures';
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
import type { NavigationActions} from '../../../types/NavigationActions';
import { useNavigationActions } from '../../../types/NavigationActions';
import { useIsAllOptional, useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';

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
const saveText = ref($t(`%1Op`));
const app = useAppContext();
const parentTypes = ParentTypeHelper.getPublicTypes();
const title = computed(() => !props.isNew ? `${patched.value.firstName || $t(`%14u`)} bewerken` : $t(`%fV`));
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
                message: $t(`%uH`),
                field: 'firstName',
            }));
        }
        if (lastName.value.length < 2) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`%104`),
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
                            message: $t(`%156`, { firstName: member.patchedMember.firstName }),
                            field: 'nationalRegisterNumber',
                        }));
                    }
                }
            }

            const parent = otherParents.find(p => p.nationalRegisterNumber === nationalRegisterNumber.value);
            if (parent) {
                se.addError(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%157`, { name: parent.name }),
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

            if (minorMembers.length > 0 && !await CenteredMessage.confirm(
                $t(`%10D`),
                $t(`%101`),
                $t(`%158`, { memberNames: Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' ' + $t(`%M1`) + ' ') }),
                $t(`%zT`),
                false)) {
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
        $t(`%zP`),
        $t(`%zQ`),
        $t(`%159`, { from: from.shortString(), to: to.shortString(), names: Formatter.joinLast(occurrences, ', ', ' ' + $t(`%M1`) + ' ') }),
        $t(`%zT`),
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
