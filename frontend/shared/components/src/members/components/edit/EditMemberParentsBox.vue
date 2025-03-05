<template>
    <div class="container">
        <Title v-bind="$attrs" :title="$t(`41afae13-62ec-4cc7-ba58-c8c1a4db2589`)"/>

        <STErrorsDefault :error-box="parentErrorBox"/>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <p v-if="visibleParents.length === 0" class="info-box">
            {{ $t('e9380d7b-ccc7-463d-a46b-95863d592ea1') }} {{ member.patchedMember.details.firstName }} {{ $t('0ec27ae4-5876-4ab3-8189-0194fc72224a') }}
        </p>

        <STList v-else :with-animation="true">
            <STListItem v-for="parent in visibleParents" :key="parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Checkbox :model-value="isParentSelected(parent)" @update:model-value="setParentSelected(parent, $event)"/>
                </template>

                <h3 class="style-title-list">
                    {{ parent.firstName }} {{ parent.lastName }}
                </h3>
                <p v-if="parent.phone" class="style-description-small">
                    {{ parent.phone }}
                </p>
                <p v-if="parent.email" class="style-description-small">
                    {{ parent.email }}
                </p>
                <p v-if="parent.address" class="style-description-small">
                    {{ parent.address }}
                </p>
                <p v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                    {{ $t('157725fc-4be3-4b8c-9073-486bfd29a94b') }} {{ parent.nationalRegisterNumber }}
                </p>

                <template #right>
                    <span v-if="!isParentSelected(parent)" class="button text limit-space">
                        <span class="icon add"/>
                        <span>{{ $t('73b74929-78f4-4cfa-8a20-92a071a84ec5') }}</span>
                    </span>

                    <button v-else class="button text limit-space" type="button" @click.stop="editParent(parent)">
                        <span class="icon edit"/>
                        <span>{{ $t('f5783f4e-6515-4988-9622-3d0b0f4290f4') }}</span>
                    </button>
                </template>
            </STListItem>
        </STList>

        <div class="style-button-bar">
            <button type="button" class="button text" :class="{selected: visibleParents.length <= 1}" @click="addParent()">
                <span class="icon add"/>
                <span>{{ $t('56ae7d01-609f-40a5-b625-d36f3d0bcc49') }}</span>
            </button>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('169a6691-dd2e-41a1-b10a-2442330dffbf') }} {{ formatDate(reviewDate) }}. <button v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'" type="button" class="inline-link" @click="clear">
                {{ $t('56bcb109-f47d-4f8b-8bd5-59cb085096bc') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { Parent, PlatformMember } from '@stamhoofd/structures';

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
import EditParentView from './EditParentView.vue';
import Title from './Title.vue';
import { useAppContext } from '../../../context';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';

defineOptions({
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox;
    willMarkReviewed?: boolean;
}>();

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const present = usePresent();
const errors = useErrors({ validator: props.validator });

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (parents.value.length === 0 && isPropertyRequired('parents')) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Voeg minstens één ouder toe',
            field: 'parents',
        }));
    }
    else if (parents.value.length > 0 && !parents.value.some(p => !!p.nationalRegisterNumber) && isPropertyRequired('parents.nationalRegisterNumber')) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Voeg bij minstens één ouder een rijksregisternummer toe.',
            field: 'parents',
        }));
    }

    if (props.member.patchedMember.details.phone) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.phone === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het GSM-nummer van een ouder niet opgeven als het GSM-nummer van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het GSM-nummer van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'phone',
            }));
        }
    }

    if (props.member.patchedMember.details.email) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.email === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het e-mailadres van een ouder niet opgeven als het e-mailadres van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het e-mailadres van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'email',
            }));
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }
    errors.errorBox = null;

    return true;
});
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const initialParents = computed(() => props.member.member.details.parents);
const parents = computed(() => props.member.patchedMember.details.parents);
const visibleParents = computed(() => {
    // combine both unique
    const result: Parent[] = [];
    for (const parent of parents.value) {
        if (!result.find(p => p.id === parent.id)) {
            result.push(parent);
        }
    }

    for (const parent of initialParents.value) {
        if (!result.find(p => p.id === parent.id)) {
            result.push(parent);
        }
    }

    // Loop family members
    for (const member of props.member.family.members) {
        for (const parent of member.patchedMember.details.parents) {
            if (!result.find(p => p.id === parent.id)) {
                result.push(parent);
            }
        }
    }

    return result;
});

function isParentSelected(parent: Parent) {
    return !!parents.value.find(p => p.id === parent.id);
}
function setParentSelected(parent: Parent, selected: boolean) {
    if (selected === isParentSelected(parent)) {
        return;
    }
    // Check if parent is present?
    if (selected) {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        patch.addDelete(parent.id); // avoids creating duplicates
        patch.addPut(parent);
        props.member.addDetailsPatch({ parents: patch });
    }
    else {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        patch.addDelete(parent.id);
        props.member.addDetailsPatch({ parents: patch });
    }
}

async function editParent(parent: Parent) {
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addParent() {
    const parent = Parent.create({});
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('parents');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('parents');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}
</script>
