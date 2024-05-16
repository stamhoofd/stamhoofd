<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox title="Titel" error-fields="type" :error-box="errors.errorBox">
                    <Dropdown v-model="type">
                        <option v-for="t in parentTypes" :key="t" :value="t">
                            {{ formatParentType(t) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errors.errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="errors.validator" :placeholder="$t('dashboard.inputs.parentPhone.placeholder')" :required="false" />
                <EmailInput v-model="email" title="E-mailadres" :validator="errors.validator" placeholder="E-mailadres van ouder" :required="false" />
            </div>

            <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="errors.validator" :required="false" />
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { Address, Parent, ParentType, ParentTypeHelper, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { usePatch } from '../../VueGlobalHelper';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import Dropdown from '../../inputs/Dropdown.vue';
import EmailInput from '../../inputs/EmailInput.vue';
import PhoneInput from '../../inputs/PhoneInput.vue';
import SelectionAddressInput from '../../inputs/SelectionAddressInput.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';

const props = defineProps<{
    member: PlatformMember,
    parent: Parent,
    isNew: boolean
}>();

const {patched, addPatch, hasChanges} = usePatch(props.parent);
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref("Opslaan");
const parentTypes = Object.values(ParentType);
const title = computed(() => !props.isNew ? `${patched.value.firstName || 'Ouder'} bewerken` : "Ouder toevoegen");

const firstName = computed({
    get: () => patched.value.firstName,
    set: (firstName) => addPatch({firstName})
});

const lastName = computed({
    get: () => patched.value.lastName,
    set: (lastName) => addPatch({lastName})
});

const type = computed({
    get: () => patched.value.type,
    set: (type) => addPatch({type})
});

const phone = computed({
    get: () => patched.value.phone,
    set: (phone) => addPatch({phone})
});

const email = computed({
    get: () => patched.value.email,
    set: (email) => addPatch({email})
});

const address = computed({
    get: () => patched.value.address,
    set: (address) => addPatch({address})
});

const availableAddresses = computed(() => {
    const list = props.member.family.addresses
    
    if (patched.value.address !== null && !list.find(a => a.toString() === patched.value.address!.toString())) {
        list.push(patched.value.address)
    }
    return list
});

function formatParentType(type: ParentType) {
    return ParentTypeHelper.getName(type)
}

async function save() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    try {
        const se = new SimpleErrors()
        if (firstName.value.length < 2) {
            se.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de voornaam in",
                field: "firstName"
            }))
        }
        if (lastName.value.length < 2) {
            se.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de achternaam in",
                field: "lastName"
            }))
        }

        if (!await errors.validator.validate()) {
            se.throwIfNotEmpty()
            loading.value = false;
            return;
        }
        se.throwIfNotEmpty()

        const old = props.parent.address
        const updated = patched.value.address

        if (old !== null && updated !== null && old.toString() !== updated.toString()) {
            await modifyAddress(old, updated)
        }

        if (props.isNew) {
            const minorMembers = props.member.family.members.filter(m => m.id !== props.member.id && m.member.details.defaultAge < 30)

            if (minorMembers.length > 0 && !await CenteredMessage.confirm("Wil je deze ouder bij alle gezinsleden toevoegen?", "Overal toevoegen", "Je kan deze ouder ook automatisch toevoegen bij " + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' en ')+'.', 'Enkel hier', false)) {
                props.member.addParent(patched.value)
            } else {
                props.member.addParent(patched.value)
                for (const member of minorMembers) {
                    member.addParent(patched.value)
                }
            }
        } else {
            props.member.family.updateParent(patched.value)
        }

        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function modifyAddress(from: Address, to: Address) {
    // todo: Check if we find this address in other places...
    const occurrences = props.member.family.getAddressOccurrences(from, {parentId: patched.value.id})

    if (occurrences.length === 0) {
        return;
    }

    if (!await CenteredMessage.confirm("Wil je dit adres overal wijzigen?", "Overal wijzigen", from.shortString() + " is ook het adres van " + Formatter.joinLast(occurrences, ', ', ' en ')+'. Als je wilt kan je het adres ook voor hen wijzigen naar '+ to.shortString() +'.', 'Enkel hier', false)) {
        return;
    }

    props.member.family.updateAddress(from, to)
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

