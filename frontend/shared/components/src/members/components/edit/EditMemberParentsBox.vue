<template>
    <div class="container">
        <Title v-bind="$attrs" title="Ouders" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        
        <p v-if="visibleParents.length === 0" class="info-box">
            Nog geen ouders toegevoegd. Voeg een ouder van {{ member.patchedMember.details.firstName }} toe via de knop hieronder.
        </p>

        <STList v-else :with-animation="true">
            <STListItem v-for="parent in visibleParents" :key="parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Checkbox :model-value="isParentSelected(parent)" @update:model-value="setParentSelected(parent, $event)" />
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

                <template #right>
                    <span v-if="!isParentSelected(parent)" class="button text limit-space">
                        <span class="icon add" />
                        <span>Toevoegen</span>
                    </span>

                    <button v-else class="button text limit-space" type="button" @click.stop="editParent(parent)">
                        <span class="icon edit" />
                        <span>Bewerken</span>
                    </button>
                </template>
            </STListItem>
        </STList>

        <div class="style-button-bar">
            <button type="button" class="button text" :class="{selected: visibleParents.length <= 1}" @click="addParent()">
                <span class="icon add" />
                <span>Ouder toevoegen</span>
            </button>
        </div>
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

defineOptions({
    inheritAttrs: false
})
const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>();

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const present = usePresent();
const errors = useErrors({validator: props.validator});
useValidation(errors.validator, () => {
    const se = new SimpleErrors()
    if (isPropertyRequired("parents") && parents.value.length === 0) {
        se.addError(new SimpleError({
            code: "invalid_field",
            message: "Voeg minstens één ouder toe",
            field: "parents"
        }))
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }
    errors.errorBox = null

    return true
});

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
        for (const parent of member.member.details.parents) {
            if (!result.find(p => p.id === parent.id)) {
                result.push(parent);
            }
        }
    }
    return result;
});

function isParentSelected(parent: Parent) {
    return !!parents.value.find(p => p.id === parent.id)
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
        props.member.addDetailsPatch({parents: patch})
    } else {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        patch.addDelete(parent.id);
        props.member.addDetailsPatch({parents: patch})
    }
}

async function editParent(parent: Parent) {
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: false
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addParent() {
    const parent = Parent.create({})
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                member: props.member,
                parent,
                isNew: true
            })
        ],
        modalDisplayStyle: "popup"
    })
}
</script>
