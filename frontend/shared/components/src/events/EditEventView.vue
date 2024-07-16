<template>
    <SaveView :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam"
                    autocomplete=""
                    enterkeyhint="next"
                >
            </STInputBox>

            <STInputBox title="Type" error-fields="type" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Type"
                    autocomplete=""
                    enterkeyhint="next"
                >
            </STInputBox>
        </div>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput
                v-model="description"
                placeholder="Beschrijving van deze activiteit"
            />
        </STInputBox>
       
        <hr>

        <STList>
            <STListItem :selectable="true" element-name="button">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Beperking op standaard leeftijdsgroep toevoegen
                </h3>
                <p class="style-description-small">
                    Stel in dat de activiteit enkel voor een bepaalde standaard (= nationaal niveau) leeftijdsgroep is.
                </p>
            </STListItem>
        </STList>
              

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze activiteit
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { WYSIWYGTextInput } from '@stamhoofd/components';
import { Event, EventMeta } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';

const props = defineProps<{
    isNew: boolean;
    event: Event;
}>();

const errors = useErrors();
const {hasChanges, patched, addPatch} = usePatch(props.event);
const title = computed(() => props.isNew ? 'Activiteit toevoegen' : 'Activiteit bewerken')

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})

const description = computed({
    get: () => patched.value.meta.description,
    set: (description) => addPatch({
        meta: EventMeta.patch({
            description
        })
    })
})

function save() {
    // todo
}

function deleteMe() {
    // todo delete
}

</script>
