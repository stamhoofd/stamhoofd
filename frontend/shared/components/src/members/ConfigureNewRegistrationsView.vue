<template>
    <SaveView :title="title" :loading="saving" :save-text="saveText" @save="save">
        <h1>{{ title }}</h1>


        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-for="g of editableRegistrations" :key="g.registration.id" class="container">
            <template v-if="editableRegistrations.length > 1">
                <hr>
                <h2>{{ g.member.patchedMember.name }} bij {{ g.group.settings.name }}</h2>
            </template>

            <STInputBox title="Prijs">
                <PriceInput :model-value="g.registration.price" @update:model-value="(price: number) => addRegistrationPatch(g, {price})" />
            </STInputBox>

            <STInputBox title="Inschrijvingsdatum" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection :model-value="g.registration.registeredAt" @update:model-value="(registeredAt: Date) => addRegistrationPatch(g, {registeredAt})" />
            </STInputBox>

            <Checkbox :model-value="g.registration.pricePaid === g.registration.price" @update:model-value="(enabled: boolean) => addRegistrationPatch(g, {pricePaid: enabled ? g.registration.price : 0})">
                Reeds betaald
            </Checkbox>

            <Checkbox :model-value="g.registration.waitingList" @update:model-value="(waitingList: boolean) => addRegistrationPatch(g, {waitingList})">
                Inschrijven op wachtlijst
            </Checkbox>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useDismiss, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Group, PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import Checkbox from '../inputs/Checkbox.vue';
import DateSelection from '../inputs/DateSelection.vue';
import PriceInput from '../inputs/PriceInput.vue';
import { NavigationActions } from '../types/NavigationActions';

const props = defineProps<{
    members: PlatformMember[],
    saveHandler: (navigate: NavigationActions) => Promise<void>|void
}>();

const title = 'Prijs en instellingen';

const saving = ref(false);
const saveText = 'Opslaan';
const errors = useErrors();
const show = useShow();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        // Copy over clone
        await props.saveHandler({
            show, present, dismiss, pop
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

type EditRegistration = {
    member: PlatformMember;
    registration: Registration;
    group: Group;
}

function addRegistrationPatch(registration: EditRegistration, patch: PartialWithoutMethods<AutoEncoderPatchType<Registration>>) {
    const member = registration.member;

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
    arr.addPatch(Registration.patch({
        id: registration.registration.id,
        ...patch
    }));
    
    member.addPatch({
        registrations: arr
    })
}

const editableRegistrations = computed(() => {
    const result: EditRegistration[] = [];

    for (const member of props.members) {
        const oldRegistrations = member.member.registrations; 
        const newRegistrations = member.patchedMember.registrations;

        for (const registration of newRegistrations) {
            if (!oldRegistrations.find(r => r.id == registration.id)) {
                const group = member.family.getOrganization(registration.organizationId)?.groups.find(g => g.id == registration.groupId) ?? null
                if (!group) {
                    console.error('Group not found', registration.groupId);
                    continue;
                }
                
                // Got one
                result.push({
                    member, 
                    registration,
                    group,
                });
            }
        }
    }
    return result;
});

</script>
