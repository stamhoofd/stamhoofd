<template>
    <SaveView :title="title" :disabled="!hasChanges" :loading="saving" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
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
                    <option v-for="t of platform.config.eventTypes" :key="t.id" :value="t.id">
                        {{ t.name }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>
        <p v-if="type" class="style-description-block">
            {{ type.description }}
        </p>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput
                v-model="description"
                placeholder="Beschrijving van deze activiteit"
            />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="button" @click="addRegistrations">
                <template #left>
                    <span class="icon gray" :class="patched.group ? 'edit' : 'add'" />
                </template>

                <h3 class="style-title-list">
                    {{ patched.group ? $t('Bewerk inschrijvinginstellingen') : $t('Inschrijvingen verzamelen') }}
                </h3>

                <p class="style-description-small">
                    Enkel leden kunnen inschrijven voor een activiteit.
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Datum</h2>

        <Checkbox v-if="!type || (type.maximumDays !== 1 && (type.minimumDays ?? 1) <= 1)" v-model="multipleDays">
            Meerdere dagen
        </Checkbox>

        <div class="split-inputs">
            <STInputBox :title="multipleDays ? 'Startdatum' : 'Datum'" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="multipleDays" v-model="startDate" title="Vanaf" :validator="errors.validator" /> 
        </div>


        <div class="split-inputs">
            <STInputBox v-if="multipleDays || (type && type.minimumDays !== null && type.minimumDays > 1)" title="Einddatum" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-else v-model="startDate" title="Vanaf" :validator="errors.validator" /> 
            <TimeInput v-model="endDate" title="Tot" :validator="errors.validator" /> 
        </div>

        <hr>
        <h2>Beschikbaarheid</h2>

        <STList>
            <STListItem v-if="canSetNationalActivity || isNationalActivity" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="isNationalActivity" />
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

        <template v-if="canSetNationalActivity && externalOrganization">
            <hr>
            <h2>Organisator</h2>
            <p>Deze activiteit is enkel zichtbaar voor leden van de organisator.</p>

            <STList>
                <STListItem v-if="externalOrganization" :selectable="true" @click="chooseOrganizer('Kies een organisator')">
                    <template #left>
                        <OrganizationAvatar :organization="externalOrganization" />
                    </template>

                    <h3 class="style-title-list">
                        {{ externalOrganization.name }}
                    </h3>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>

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
                <div>Standaard leeftijdsgroepen</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteDefaultAgeGroupRestriction" />
                </div>
            </h2>

            <p>De activiteit is enkel zichtbaar voor leden die ingeschreven zijn bij één van deze standaard leeftijdsgroepen.</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" />
        </JumpToContainer>

        <JumpToContainer :visible="groups !== null">
            <hr>

            <h2 class="style-with-button">
                <div>Leeftijdsgroepen</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteGroupsRestriction" />
                </div>
            </h2>

            <p>De activiteit is enkel zichtbaar voor leden die ingeschreven zijn bij één van deze leeftijdsgroepen.</p>

            <p class="info-box" v-if="!organization || !externalOrganization || externalOrganization?.id !== organization.id">
                Je kan dit voorlopig enkel bewerken via het beheerdersportaal van de organisator.
            </p>
            <GroupsInput v-else v-model="groups" :date="startDate" />
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
            <STListItem v-if="defaultAgeGroupIds === null && isNationalActivity" :selectable="true" element-name="button" @click="addDefaultAgeGroupRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Beperking op standaard leeftijdsgroep toevoegen
                </h3>
            </STListItem>

            <STListItem v-if="!isNationalActivity && externalOrganization && organization && organization.id === externalOrganization.id && groups === null" :selectable="true" element-name="button" @click="addGroupsRestriction">
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
                    {{ $t('Locatie toevoegen') }}
                </h3>
            </STListItem>

            <STListItem v-if="!coverPhoto" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="coverPhoto" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('Omslagfoto toevoegen') }}
                    </h3>
                </UploadButton>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AddressInput, CenteredMessage, DateSelection, Dropdown, EditGroupView, ErrorBox, ImageComponent, NavigationActions, OrganizationAvatar, TagIdsInput, TimeInput, Toast, UploadButton, useAppContext, useExternalOrganization, WYSIWYGTextInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Event, EventLocation, EventMeta, Group, GroupSettings, GroupType, Organization, ResolutionRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watchEffect } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useContext, useOrganization, usePatch, usePlatform } from '../hooks';
import DefaultAgeGroupIdsInput from '../inputs/DefaultAgeGroupIdsInput.vue';
import GroupsInput from '../inputs/GroupsInput.vue';
import SearchOrganizationView from '../members/SearchOrganizationView.vue';

const props = withDefaults(
    defineProps<{
        isNew: boolean;
        event: Event;
        callback?: (() => void)|null;
    }>(),
    {
        callback: null
    }
);

const errors = useErrors();
const {hasChanges, patched, addPatch, patch} = usePatch(props.event);
const title = computed(() => props.isNew ? 'Activiteit toevoegen' : 'Activiteit bewerken')
const saving = ref(false)
const deleting = ref(false)
const $t = useTranslate()
const context = useContext();
const pop = usePop();
const organization = useOrganization();
const present = usePresent();
const platform = usePlatform();

const {externalOrganization, choose: chooseOrganizer, loading, errorBox: organizerEventBox} = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: (organizationId) => addPatch({
            organizationId
        })
    })
)


const type = computed(() => {
    const type = platform.value.config.eventTypes.find(e => e.id === patched.value.typeId)
    return type ?? null
})

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
            d.setDate(startDate.value.getDate() + (Math.max(2, type.value?.minimumDays || 2) - 1))
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

// Auto correct invalid types
watchEffect(() => {
    const t = type.value
    if (!t) {
        addPatch({typeId: platform.value.config.eventTypes[0].id})
        return;
    }

    if (t.minimumDays !== null && t.minimumDays > 1 && !multipleDays.value) {
        multipleDays.value = true
    }

    if (t.maximumDays === 1 && multipleDays.value) {
        multipleDays.value = false
    }
})


const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => {
        const wasMultipleDays = multipleDays.value
        addPatch({startDate})

        if (!wasMultipleDays) {
            // Makse sure end date remains same date
            const d = new Date(endDate.value)
            d.setFullYear(startDate.getFullYear())
            d.setMonth(startDate.getMonth())
            d.setDate(startDate.getDate())
            endDate.value = d
        }
    }
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

const groups = computed({
    get: () => patched.value.meta.groups,
    set: (groups) => 
        addPatch({
            meta: EventMeta.patch({
                groups: groups as any
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

const app = useAppContext()
const canSetNationalActivity = computed(() => app === 'admin')
const isNationalActivity = computed({
    get: () => patched.value.organizationId === null,
    set: (isNationalActivity) => {
        if (isNationalActivity) {
            addPatch({
                organizationId: null
            })
        } else {
            const organizationId = props.event.organizationId || organization.value?.id

            if (!organizationId) {
                chooseOrganizer('Kies een organisator').catch(console.error)
                return
            }
            addPatch({
                organizationId
            })
        }
    }
})

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

function addGroupsRestriction() {
    groups.value = []
}

function deleteDefaultAgeGroupRestriction() {
    defaultAgeGroupIds.value = null
}

function deleteGroupsRestriction() {
    groups.value = null
}

function addTagRestriction() {
    organizationTagIds.value = []
}

function deleteTagRestriction() {
    organizationTagIds.value = null
}


async function save() {
    if (saving.value) {
        return;
    }


    errors.errorBox = null;

    saving.value = true;

    try {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;

        if (props.isNew) {
            arr.addPut(patched.value)
        } else {
            arr.addPatch(patch.value)
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/events',
            body: arr,
            decoder: new ArrayDecoder(Event as Decoder<Event>),
        })

        Toast.success($t('shared.saveConfirmation')).show()

        // Make sure original event is patched
        deepSetArray([props.event], response.data)

        props.callback?.()
        
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    
    }

    saving.value = false;
}

async function addRegistrations() {
    
    if (patched.value.group) {
        // Edit the group
        await present({
            components: [
                new ComponentWithProperties(EditGroupView, {
                    group: patched.value.group,
                    isMultiOrganization: isNationalActivity.value,
                    isNew: false,
                    showToasts: false,
                    saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                        addPatch({
                            group: patch
                        })
                    },
                    deleteHandler: async () => {
                        addPatch({
                            group: null
                        })
                    }
                })
            ],
            modalDisplayStyle: 'popup'
        })
    } else {
        const organizationId = patched.value.organizationId ?? undefined
        const group = Group.create({
            organizationId,
            periodId: externalOrganization.value?.period.period.id ?? organization.value?.period.period.id,
            type: GroupType.EventRegistration,
            settings: GroupSettings.create({
                name: patched.value.name
            })
        })

        if (!organizationId) {
            // Kies een organisator
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(SearchOrganizationView, {
                            title: 'Kies een organisator van deze inschrijvingen',
                            description: 'Voor nationale activiteiten moet je kiezen via welke groep alle betalingen verlopen. De betaalinstellingen van die groep worden dan gebruikt en alle inschrijvingen worden dan ingeboekt in de boekhouding van die groep.\n\nDaarnaast bepaalt de organisator ook instellingen die invloed hebben op de dataverzameling en andere subtielere zaken.',
                            selectOrganization: async (organization: Organization, navigation: NavigationActions) => {
                                group.organizationId = organization.id
                                group.periodId = organization.period.period.id
                                await navigation.show({
                                    force: true,
                                    replace: 1,
                                    components: [
                                        new ComponentWithProperties(EditGroupView, {
                                            group: group,
                                            isNew: true,
                                            showToasts: false,
                                            saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                                                addPatch({
                                                    group: group.patch(patch)
                                                })
                                            }
                                        })
                                    ]
                                })
                            }
                        })
                    })
                ],
                modalDisplayStyle: 'popup'
            })
            return;
        }

        // Edit the group
        await present({
            components: [
                new ComponentWithProperties(EditGroupView, {
                    group: group,
                    isNew: true,
                    showToasts: false,
                    saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                        addPatch({
                            group: group.patch(patch)
                        })
                    }
                })
            ],
            modalDisplayStyle: 'popup'
        })
    }

}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze activiteit wilt verwijderen?'), $t('Verwijderen'), $t('Je verliest alle bijhorende informatie en kan dit niet ongedaan maken.'))) {
        return
    }

    if (saving.value || deleting.value) {
        return;
    }

    deleting.value = true;

    try {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
        arr.addDelete(props.event.id)

        await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/events',
            body: arr,
            decoder: new ArrayDecoder(Event as Decoder<Event>),
        })

        Toast.success($t('De activiteit is verwijderd')).show()
        props.callback?.()
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    
    }

    deleting.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})

</script>
