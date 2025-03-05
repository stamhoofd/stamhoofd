<template>
    <div class="container">
        <Title v-bind="$attrs" :title="$t(`e15c88bd-63b3-4b9f-b8e9-336c03b9c5a2`)"/>

        <p v-if="member.isPropertyEnabled('parents')" class="style-description-block">
            {{ $t('200052d8-ee09-4f1d-9a48-147da9496f0d') }}
        </p>

        <STErrorsDefault :error-box="parentErrorBox"/>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <p v-if="visibleContacts.length === 0" class="info-box">
            {{ $t('53e20c11-a95c-4ba0-9710-6a55215e2535') }} {{ member.patchedMember.details.firstName }} {{ $t('0ec27ae4-5876-4ab3-8189-0194fc72224a') }}
        </p>

        <STList v-if="visibleContacts.length > 0" :with-animation="true">
            <STListItem v-for="contact in visibleContacts" :key="contact.id" :selectable="true" element-name="label" class="right-stack">
                <template #left>
                    <Checkbox :model-value="isContactSelected(contact)" @update:model-value="setContactSelected(contact, $event)"/>
                </template>

                <h2 class="style-title-list">
                    {{ contact.name }} ({{ contact.title }})
                </h2>
                <p v-if="contact.phone" class="style-description-small">
                    {{ contact.phone }}
                </p>

                <template #right>
                    <span v-if="!isContactSelected(contact)" class="button text limit-space">
                        <span class="icon add"/>
                        <span>{{ $t('73b74929-78f4-4cfa-8a20-92a071a84ec5') }}</span>
                    </span>

                    <button v-else class="button text limit-space" type="button" @click.stop="editContact(contact)">
                        <span class="icon edit"/>
                        <span>{{ $t('f5783f4e-6515-4988-9622-3d0b0f4290f4') }}</span>
                    </button>
                </template>
            </STListItem>
        </STList>

        <div class="style-button-bar">
            <button type="button" class="button text" :class="{selected: visibleContacts.length <= 0}" @click="addContact()">
                <span class="icon add"/>
                <span>{{ $t('fab6c1e3-2028-4750-820e-12497a55a0c2') }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { EmergencyContact, PlatformMember } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { computed } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import STList from '../../../layout/STList.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import EditEmergencyContactView from './EditEmergencyContactView.vue';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
}>();
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const present = usePresent();
const errors = useErrors({ validator: props.validator });

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (isPropertyRequired('emergencyContacts') && emergencyContacts.value.length === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Voeg minstens één noodcontactpersoon toe',
            field: 'emergencyContacts',
        }));
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }
    errors.errorBox = null;

    return true;
});

const initialContacts = computed(() => props.member.member.details.emergencyContacts);
const emergencyContacts = computed(() => props.member.patchedMember.details.emergencyContacts);
const visibleContacts = computed(() => {
    // combine both unique
    const result: EmergencyContact[] = [];
    for (const contact of emergencyContacts.value) {
        if (!result.find(p => p.id === contact.id)) {
            result.push(contact);
        }
    }

    for (const contact of initialContacts.value) {
        if (!result.find(p => p.id === contact.id)) {
            result.push(contact);
        }
    }

    // Loop family members
    for (const member of props.member.family.members) {
        for (const contact of member.member.details.emergencyContacts) {
            if (!result.find(p => p.id === contact.id)) {
                result.push(contact);
            }
        }
    }
    return result;
});

function isContactSelected(contact: EmergencyContact) {
    return !!emergencyContacts.value.find(p => p.id === contact.id);
}
function setContactSelected(contact: EmergencyContact, selected: boolean) {
    if (selected === isContactSelected(contact)) {
        return;
    }
    // Check if contact is present?
    if (selected) {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
        patch.addDelete(contact.id); // avoids creating duplicates
        patch.addPut(contact);
        props.member.addDetailsPatch({ emergencyContacts: patch });
    }
    else {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
        patch.addDelete(contact.id);
        props.member.addDetailsPatch({ emergencyContacts: patch });
    }
}

async function editContact(emergencyContact: EmergencyContact) {
    await present({
        components: [
            new ComponentWithProperties(EditEmergencyContactView, {
                member: props.member,
                emergencyContact,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addContact() {
    const emergencyContact = EmergencyContact.create({});
    await present({
        components: [
            new ComponentWithProperties(EditEmergencyContactView, {
                member: props.member,
                emergencyContact,
                isNew: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
