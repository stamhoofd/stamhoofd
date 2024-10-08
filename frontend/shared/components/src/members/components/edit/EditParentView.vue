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

                <PhoneInput v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34')" :validator="errors.validator" :placeholder="$t('7f30db7e-4851-4aa6-b731-2c898054f707')" :required="app === 'registration'" />
                
                <EmailInput v-model="email" :required="app === 'registration'" :title="'E-mailadres' " placeholder="E-mailadres van ouder" :validator="errors.validator">
                        <template #right>
                        <button class="button icon add gray" type="button" @click="addEmail" v-tooltip="'Alternatief e-mailadres toevoegen'"/>
                    </template>
                </EmailInput>
                <EmailInput 
                    :model-value="getEmail(n - 1)" 
                    @update:modelValue="setEmail(n - 1, $event)" 
                    :required="true" 
                    :title="'Alternatief e-mailadres ' + (alternativeEmails.length > 1 ? n : '') " 
                    placeholder="E-mailadres van ouder" 
                    :validator="errors.validator"  
                    v-for="n in alternativeEmails.length" 
                    :key="n"
                >
                    <template #right>
                        <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>
            
                <p class="style-description-small" v-if="email && member && member.patchedMember.details.parentsHaveAccess && app !== 'registration'">Deze ouder kan inloggen of registreren op <template v-if="alternativeEmails.length">één van de ingevoerde e-mailadressen</template><template v-else>het ingevoerde e-mailadres</template> en krijgt dan automatisch toegang tot de gegevens van {{ member.patchedMember.firstName }} en het ledenportaal.</p>
                <p class="style-description-small" v-else-if="firstName && email && member && member.patchedMember.details.parentsHaveAccess">{{ firstName }} kan inloggen of registreren op <template v-if="alternativeEmails.length">één van de ingevoerde e-mailadressen</template><template v-else>het ingevoerde e-mailadres</template> en krijgt dan automatisch toegang tot de gegevens van {{ member.patchedMember.firstName }} en het ledenportaal.</p>
            
                <p v-if="alternativeEmails.length && member && member.patchedMember.details.parentsHaveAccess" class="style-description-small">
                    <template v-if="app !== 'registration'">De ouder ontvangt enkel communicatie op het eerste e-mailadres.</template>
                    <template v-else>{{ firstName }} ontvangt enkel communicatie op het eerste e-mailadres.</template>
                </p>
            </div>

            <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="errors.validator" :required="app === 'registration'" />
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { Address, Parent, ParentType, ParentTypeHelper, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { usePatch } from '../../../hooks';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import Dropdown from '../../../inputs/Dropdown.vue';
import EmailInput from '../../../inputs/EmailInput.vue';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import SelectionAddressInput from '../../../inputs/SelectionAddressInput.vue';
import { CenteredMessage } from '../../../overlays/CenteredMessage';
import { NavigationActions, useNavigationActions } from '../../../types/NavigationActions';
import { useAppContext } from '../../../context/appContext';

const props = withDefaults(defineProps<{
    member?: PlatformMember|null,
    family?: PlatformFamily|null
    parent: Parent,
    isNew: boolean,
    saveHandler?: ((navigate: NavigationActions) => Promise<void>|void)|null
}>(), {
    member: null,
    family: null,
    saveHandler: null,
});

const family = props.family || props.member!.family;
const {patched, addPatch, hasChanges} = usePatch(props.parent);
const errors = useErrors();
const pop = usePop();
const loading = ref(false);
const saveText = ref("Opslaan");
const parentTypes = Object.values(ParentType);
const title = computed(() => !props.isNew ? `${patched.value.firstName || 'Ouder'} bewerken` : "Ouder toevoegen");
const navigate = useNavigationActions();
const app = useAppContext()

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

const alternativeEmails = computed({
    get: () => patched.value.alternativeEmails,
    set: (alternativeEmails) => addPatch({
        alternativeEmails: alternativeEmails as any
    })
});
const availableAddresses = computed(() => {
    const list = family.addresses
    
    if (patched.value.address !== null && !list.find(a => a.toString() === patched.value.address!.toString())) {
        list.push(patched.value.address)
    }
    return list
});

function deleteEmail(n: number) {
    const newEmails = [...alternativeEmails.value];
    newEmails.splice(n, 1);
    alternativeEmails.value = newEmails;
}

function addEmail() {
    alternativeEmails.value = [...alternativeEmails.value, ""];
}

function getEmail(index: number) {
    return alternativeEmails.value[index] ?? "";
}

function setEmail(index: number, value: string) {
    const newEmails = [...alternativeEmails.value];
    newEmails[index] = value;
    alternativeEmails.value = newEmails;
}

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

        if (props.member && props.isNew) {
            const minorMembers = family.members.filter(m => m.id !== props.member!.id && m.isPropertyEnabled('parents'))

            if (minorMembers.length > 0 && !await CenteredMessage.confirm("Wil je deze ouder bij alle gezinsleden toevoegen?", "Overal toevoegen", "Je kan deze ouder ook automatisch toevoegen bij " + Formatter.joinLast(minorMembers.map(m => m.member.firstName), ', ', ' en ')+'.', 'Enkel hier', false)) {
                props.member.addParent(patched.value)
            } else {
                props.member.addParent(patched.value)
                for (const member of minorMembers) {
                    member.addParent(patched.value)
                }
            }
        } else {
            family.updateParent(patched.value)
        }

        if (props.saveHandler) {
            await props.saveHandler(navigate);
        } else {
            await pop({force: true})
        }

    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function modifyAddress(from: Address, to: Address) {
    // todo: Check if we find this address in other places...
    const occurrences = family.getAddressOccurrences(from, {parentId: patched.value.id})

    if (occurrences.length === 0) {
        return;
    }

    if (!await CenteredMessage.confirm("Wil je dit adres overal wijzigen?", "Overal wijzigen", from.shortString() + " is ook het adres van " + Formatter.joinLast(occurrences, ', ', ' en ')+'. Als je wilt kan je het adres ook voor hen wijzigen naar '+ to.shortString() +'.', 'Enkel hier', false)) {
        return;
    }

    family.updateAddress(from, to)
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

