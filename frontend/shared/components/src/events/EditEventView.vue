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
                <Dropdown
                    v-model="typeId"
                >
                    <option value="">
                        Geen
                    </option>
                    <option value="todo">
                        Kamp
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <Checkbox v-model="multipleDays">
            Meerdere dagen
        </Checkbox>

        <div class="split-inputs">
            <STInputBox :title="multipleDays ? 'Startdatum' : 'Datum'" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="multipleDays" v-model="startDate" title="Vanaf" :validator="errors.validator" /> 
        </div>


        <div class="split-inputs">
            <STInputBox v-if="multipleDays" title="Einddatum" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-else v-model="startDate" title="Vanaf" :validator="errors.validator" /> 
            <TimeInput v-model="endDate" title="Tot" :validator="errors.validator" /> 
        </div>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput
                v-model="description"
                placeholder="Beschrijving van deze activiteit"
            />
        </STInputBox>

        <hr>
        <h2>Beschikbaarheid</h2>

        <STList>
            <STListItem v-if="isNationalActivity" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="isNationalActivity" :disabled="true" />
                </template>

                <h3 class="style-title-list">
                    Nationale of regionale activiteit
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="visible" />
                </template>

                <h3 class="style-title-list">
                    Zichtbaar in de kalender
                </h3>
            </STListItem>
        </STList>

        <JumpToContainer :visible="isNationalActivity && organizationTagIds !== null">
            <hr>

            <h2 class="style-with-button">
                <div>Regio</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteTagRestriction" />
                </div>
            </h2>
            <p>Kies voor welke groepen deze activiteit zichtbaar is.</p>

            <TagIdsInput v-model="organizationTagIds" />
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr>

            <h2 class="style-with-button">
                <div>Leeftijdsgroepen</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteDefaultAgeGroupRestriction" />
                </div>
            </h2>

            <p>De activiteit is enkel zichtbaar voor leden die ingeschreven zijn bij één van deze leeftijdsgroepen.</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" />
        </JumpToContainer>

        <JumpToContainer :visible="!!location">
            <hr>
            <h2 class="style-with-button">
                <div>Locatie</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteLocation" />
                </div>
            </h2>

            <STInputBox title="Naam locatie" error-fields="location.name" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="locationName"
                    class="input"
                    type="text"
                    placeholder="bv. Gemeentelijke feestzaal"
                    autocomplete=""
                    enterkeyhint="next"
                >
            </STInputBox>

            <AddressInput v-model="locationAddress" title="Adres (optioneel)" :nullable="true" :required="false" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="!!coverPhoto">
            <hr>
            <h2 class="style-with-button">
                <div>Omslagfoto</div>
                <div>
                    <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                        <span class="icon trash" />
                        <span>Verwijderen</span>
                    </button>
                    <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Uploaden'" :resolutions="resolutions" />
                </div>
            </h2>

            <ImageComponent :image="coverPhoto" :auto-height="true" />
        </JumpToContainer>

        <hr>

        <STList>
            <STListItem v-if="defaultAgeGroupIds === null" :selectable="true" element-name="button" @click="addDefaultAgeGroupRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Beperking op leeftijdsgroep toevoegen
                </h3>
            </STListItem>

            <STListItem v-if="isNationalActivity && organizationTagIds === null" :selectable="true" element-name="button" @click="addTagRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Beperking op regio toevoegen
                </h3>
            </STListItem>

            <STListItem v-if="!location" :selectable="true" element-name="button" @click="addLocation">
                <template #left>
                    <span class="icon location gray" />
                </template>

                <h3 class="style-title-list">
                    Locatie toevoegen
                </h3>
            </STListItem>

            <STListItem v-if="!coverPhoto" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="coverPhoto" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        Omslagfoto toevoegen
                    </h3>
                </UploadButton>
            </STListItem>

            <STListItem :selectable="true" element-name="button">
                <template #left>
                    <span class="icon edit gray" />
                </template>

                <h3 class="style-title-list">
                    Inschrijvingen verzamelen
                </h3>
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
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput, DateSelection, Dropdown, ErrorBox, ImageComponent, TagIdsInput, TimeInput, UploadButton, WYSIWYGTextInput } from '@stamhoofd/components';
import { Event, EventLocation, EventMeta, ResolutionRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import DefaultAgeGroupIdsInput from '../inputs/DefaultAgeGroupIdsInput.vue';
import JumpToContainer from '../containers/JumpToContainer.vue';

const props = defineProps<{
    isNew: boolean;
    event: Event;
}>();

const errors = useErrors();
const {hasChanges, patched, addPatch} = usePatch(props.event);
const title = computed(() => props.isNew ? 'Activiteit toevoegen' : 'Activiteit bewerken')

const multipleDays = computed({
    get: () => {
        return Formatter.dateNumber(patched.value.startDate, true) !== Formatter.dateNumber(patched.value.endDate, true)
    },
    set: (md) => {
        if (md === multipleDays.value) {
            return;
        }
        if (md) {
            const d = new Date(endDate.value)
            d.setDate(startDate.value.getDate() + 1)
            endDate.value = d
        } else {
            const d = new Date(endDate.value)
            d.setFullYear(startDate.value.getFullYear())
            d.setMonth(startDate.value.getMonth())
            d.setDate(startDate.value.getDate())
            endDate.value = d
        }
    }
})

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => addPatch({startDate})
})

const endDate = computed({
    get: () => patched.value.endDate,
    set: (endDate) => addPatch({endDate})
})


const typeId = computed({
    get: () => patched.value.typeId,
    set: (typeId) => addPatch({typeId})
})

const organizationTagIds = computed({
    get: () => patched.value.meta.organizationTagIds,
    set: (organizationTagIds) => 
        addPatch({
            meta: EventMeta.patch({
                organizationTagIds: organizationTagIds as any
            })
        })
})

const defaultAgeGroupIds = computed({
    get: () => patched.value.meta.defaultAgeGroupIds,
    set: (defaultAgeGroupIds) => 
        addPatch({
            meta: EventMeta.patch({
                defaultAgeGroupIds: defaultAgeGroupIds as any
            })
        })
})

const location = computed({
    get: () => patched.value.meta.location,
    set: (location) => 
        addPatch({
            meta: EventMeta.patch({
                location
            })
        })
})

const coverPhoto = computed({
    get: () => patched.value.meta.coverPhoto,
    set: (coverPhoto) => 
        addPatch({
            meta: EventMeta.patch({
                coverPhoto
            })
        })
})

const locationName = computed({
    get: () => location.value?.name ?? '',
    set: (name) => {
        if (location.value) {
            addPatch({
                meta: EventMeta.patch({
                    location: EventLocation.patch({
                        name
                    })
                })
            })
        }
    }
})

const locationAddress = computed({
    get: () => location.value?.address ?? null,
    set: (address) => {
        if (location.value) {
            addPatch({
                meta: EventMeta.patch({
                    location: EventLocation.patch({
                        address
                    })
                })
            })
        }
    }
})

const isNationalActivity = computed(() => patched.value.organizationId === null)

const description = computed({
    get: () => patched.value.meta.description,
    set: (description) => addPatch({
        meta: EventMeta.patch({
            description
        })
    })
})

const visible = computed({
    get: () => patched.value.meta.visible,
    set: (visible) => addPatch({
        meta: EventMeta.patch({
            visible
        })
    })
})

const resolutions = [
    ResolutionRequest.create({
        width: 1200,
    }),
    ResolutionRequest.create({
        width: 600,
    }),
    ResolutionRequest.create({
        width: 300
    }),
    ResolutionRequest.create({
        width: 100
    })
]


function addLocation() {
    location.value = EventLocation.create({})
}

function deleteLocation() {
    location.value = null
}

function addDefaultAgeGroupRestriction() {
    defaultAgeGroupIds.value = []
}

function deleteDefaultAgeGroupRestriction() {
    defaultAgeGroupIds.value = null
}

function addTagRestriction() {
    organizationTagIds.value = []
}

function deleteTagRestriction() {
    organizationTagIds.value = null
}


async function save() {
    // todo
    if (endDate.value < startDate.value) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'invalid_field',
                field: 'endDate',
                message: 'De einddatum moet na de startdatum liggen'
            })
        )
        return ;
    }
    errors.errorBox = null;
}

function deleteMe() {
    // todo delete
}

</script>
