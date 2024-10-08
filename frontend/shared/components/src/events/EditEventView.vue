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

            <STInputBox v-if="platform.config.eventTypes.length" title="Type" error-fields="type" :error-box="errors.errorBox">
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
                    {{ patched.group ? $t('76eb7982-9fc5-490a-9414-42bb7f10b8d6') : $t('8c30c20d-b734-4ece-bca9-292d064c5028') }}
                </h3>

                <p class="style-description-small">
                    Laat leden inschrijven voor deze activiteit via het ledenportaal
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
                <STListItem v-if="externalOrganization" :selectable="true" @click="chooseOrganizer('Kies een organisator', canSelectOrganization)">
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
                    <button v-if="!hasTagRestrictions" type="button" class="button icon trash" @click="deleteTagRestriction" />
                </div>
            </h2>
            <p>Kies voor welke groepen deze activiteit zichtbaar is.</p>

            <TagIdsInput v-model="organizationTagIds" :is-tag-enabled-predicate="isTagEnabledPredicate" />
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
                    <button v-if="!hasGroupRestrictions" type="button" class="button icon trash" @click="deleteGroupsRestriction" />
                </div>
            </h2>

            <p>De activiteit is enkel zichtbaar voor leden die ingeschreven zijn bij één van deze leeftijdsgroepen.</p>

            <p v-if="!organization || !externalOrganization || externalOrganization?.id !== organization.id" class="info-box">
                Je kan dit voorlopig enkel bewerken via het beheerdersportaal van de organisator.
            </p>
            <GroupsInput v-else v-model="groups" :date="startDate" :is-group-enabled-operator="isGroupEnabledOperator" />
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

            <AddressInput v-model="locationAddress" title="Adres (optioneel)" :nullable="true" :required="isLocationRequired" :validator="errors.validator" />
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

            <STListItem v-if="!isNationalActivity && externalOrganization && organization && organization.id === externalOrganization.id && groups === null && !hasGroupRestrictions" :selectable="true" element-name="button" @click="addGroupsRestriction">
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
                    {{ $t('b735b655-5037-4b7c-90d2-711ac066c194') }}
                </h3>
            </STListItem>

            <STListItem v-if="!coverPhoto" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="coverPhoto" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('9448b5c3-579e-48c4-a4a4-2d8d0e6210b8') }}
                    </h3>
                </UploadButton>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AddressInput, CenteredMessage, DateSelection, Dropdown, EditGroupView, ErrorBox, GlobalEventBus, ImageComponent, NavigationActions, OrganizationAvatar, TagIdsInput, TimeInput, Toast, UploadButton, useAppContext, useExternalOrganization, WYSIWYGTextInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Event, EventLocation, EventMeta, Group, GroupSettings, GroupType, Organization, ResolutionRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch, watchEffect } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useContext, useOrganization, usePatch, usePlatform } from '../hooks';
import DefaultAgeGroupIdsInput from '../inputs/DefaultAgeGroupIdsInput.vue';
import GroupsInput from '../inputs/GroupsInput.vue';
import SearchOrganizationView from '../members/SearchOrganizationView.vue';
import DeleteView from '../views/DeleteView.vue';
import { useEventPermissions } from './composables/useEventPermissions';

const props = withDefaults(
    defineProps<{
        isNew: boolean;
        event: Event;
        callback?: (() => void) | null;
    }>(),
    {
        callback: null,
    },
);

const errors = useErrors();
const { hasChanges, patched, addPatch, patch } = usePatch(props.event);
const title = computed(() => props.isNew ? 'Activiteit toevoegen' : 'Activiteit bewerken');
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const context = useContext();
const pop = usePop();
const organization = useOrganization();
const present = usePresent();
const platform = usePlatform();
const eventPermissions = useEventPermissions();

const { externalOrganization, choose: chooseOrganizer } = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: organizationId => addPatch({
            organizationId,
        }),
    }),
);

const type = computed(() => {
    const type = platform.value.config.eventTypes.find(e => e.id === patched.value.typeId);
    return type ?? null;
});

const isLocationRequired = computed(() => type.value?.isLocationRequired ?? false);

const multipleDays = computed({
    get: () => {
        return Formatter.dateNumber(patched.value.startDate, true) !== Formatter.dateNumber(patched.value.endDate, true);
    },
    set: (md) => {
        if (md === multipleDays.value) {
            return;
        }
        if (md) {
            const d = new Date(endDate.value);
            d.setDate(startDate.value.getDate() + (Math.max(2, type.value?.minimumDays || 2) - 1));
            endDate.value = d;
        }
        else {
            const d = new Date(endDate.value);
            d.setFullYear(startDate.value.getFullYear());
            d.setMonth(startDate.value.getMonth());
            d.setDate(startDate.value.getDate());
            endDate.value = d;
        }
    },
});

// Auto correct invalid types
watchEffect(() => {
    const t = type.value;
    if (!t) {
        if (platform.value.config.eventTypes.length) {
            addPatch({ typeId: platform.value.config.eventTypes[0].id });
        }
        return;
    }

    if (t.minimumDays !== null && t.minimumDays > 1 && !multipleDays.value) {
        multipleDays.value = true;
    }

    if (t.maximumDays === 1 && multipleDays.value) {
        multipleDays.value = false;
    }
});

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => {
        const wasMultipleDays = multipleDays.value;
        addPatch({ startDate });

        if (!wasMultipleDays) {
            // Makse sure end date remains same date
            const d = new Date(endDate.value);
            d.setFullYear(startDate.getFullYear());
            d.setMonth(startDate.getMonth());
            d.setDate(startDate.getDate());
            endDate.value = d;
        }
    },
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: endDate => addPatch({ endDate }),
});

const typeId = computed({
    get: () => patched.value.typeId,
    set: typeId => addPatch({ typeId }),
});

const organizationTagIds = computed({
    get: () => patched.value.meta.organizationTagIds,
    set: organizationTagIds =>
        addPatch({
            meta: EventMeta.patch({
                organizationTagIds: organizationTagIds as any,
            }),
        }),
});

const defaultAgeGroupIds = computed({
    get: () => patched.value.meta.defaultAgeGroupIds,
    set: defaultAgeGroupIds =>
        addPatch({
            meta: EventMeta.patch({
                defaultAgeGroupIds: defaultAgeGroupIds as any,
            }),
        }),
});

const groups = computed({
    get: () => patched.value.meta.groups,
    set: groups =>
        addPatch({
            meta: EventMeta.patch({
                groups: groups as any,
            }),
        }),
});

const location = computed({
    get: () => patched.value.meta.location,
    set: location =>
        addPatch({
            meta: EventMeta.patch({
                location,
            }),
        }),
});

const coverPhoto = computed({
    get: () => patched.value.meta.coverPhoto,
    set: coverPhoto =>
        addPatch({
            meta: EventMeta.patch({
                coverPhoto,
            }),
        }),
});

const locationName = computed({
    get: () => location.value?.name ?? '',
    set: (name) => {
        if (location.value) {
            addPatch({
                meta: EventMeta.patch({
                    location: EventLocation.patch({
                        name,
                    }),
                }),
            });
        }
    },
});

const locationAddress = computed({
    get: () => location.value?.address ?? null,
    set: (address) => {
        if (location.value) {
            addPatch({
                meta: EventMeta.patch({
                    location: EventLocation.patch({
                        address,
                    }),
                }),
            });
        }
    },
});

const app = useAppContext();
const canSetNationalActivity = computed(() => app === 'admin');
const isNationalActivity = computed({
    get: () => patched.value.organizationId === null,
    set: (isNationalActivity) => {
        if (isNationalActivity) {
            addPatch({
                organizationId: null,
            });
        }
        else {
            const organizationId = props.event.organizationId || organization.value?.id;

            if (!organizationId) {
                chooseOrganizer('Kies een organisator', canSelectOrganization).catch(console.error);
                return;
            }
            addPatch({
                organizationId,
            });
        }
    },
});

const description = computed({
    get: () => patched.value.meta.description,
    set: description => addPatch({
        meta: EventMeta.patch({
            description,
        }),
    }),
});

const visible = computed({
    get: () => patched.value.meta.visible,
    set: visible => addPatch({
        meta: EventMeta.patch({
            visible,
        }),
    }),
});

const hasGroupRestrictions = computed(() => !isNationalActivity.value && organization.value && !eventPermissions.canWriteAllGroupEvents());
const hasTagRestrictions = computed(() => isNationalActivity.value && !eventPermissions.canWriteAllTagEvents());

watch(hasGroupRestrictions, (hasGroupRestrictions) => {
    if (hasGroupRestrictions && groups.value === null) {
        addGroupsRestriction();
    }
}, { immediate: true });

watch(hasTagRestrictions, (hasTagRestrictions) => {
    if (hasTagRestrictions) {
        if (organizationTagIds.value === null) {
            addTagRestriction();
        }
    }
    else if (organizationTagIds.value?.length === 0) {
        deleteTagRestriction();
    }
}, { immediate: true });

const isGroupEnabledOperator = computed(() => {
    if (!hasGroupRestrictions.value) {
        return undefined;
    }

    return eventPermissions.isGroupEnabledOperatorFactory();
});

const isTagEnabledPredicate = computed(() => {
    if (!hasTagRestrictions.value) {
        return undefined;
    }

    return eventPermissions.isTagEnabledPredicateFactory();
});

const canSelectOrganization = (organization: Organization) => {
    const result = eventPermissions.canAdminEventForExternalOrganization(organization);
    if (!result) {
        Toast.error('Je hebt geen rechten om een activiteit aan te maken voor deze organisatie.')
            .show();
    }
    return result;
};

const resolutions = [
    ResolutionRequest.create({
        width: 1200,
    }),
    ResolutionRequest.create({
        width: 600,
    }),
    ResolutionRequest.create({
        width: 300,
    }),
    ResolutionRequest.create({
        width: 100,
    }),
];

function addLocation() {
    location.value = EventLocation.create({});
}

function deleteLocation() {
    location.value = null;
}

function addDefaultAgeGroupRestriction() {
    defaultAgeGroupIds.value = [];
}

function addGroupsRestriction() {
    groups.value = [];
}

function deleteDefaultAgeGroupRestriction() {
    defaultAgeGroupIds.value = null;
}

function deleteGroupsRestriction() {
    groups.value = null;
}

function addTagRestriction() {
    organizationTagIds.value = [];
}

function deleteTagRestriction() {
    organizationTagIds.value = null;
}

async function save() {
    if (saving.value) {
        return;
    }

    errors.errorBox = null;

    saving.value = true;

    if (!await errors.validator.validate()) {
        saving.value = false;
        return;
    }

    try {
        // #region validate location
        if (isLocationRequired.value) {
            if (!location.value) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'De locatie is verplicht voor deze soort activiteit.',
                    field: 'event_required',
                });
            }
        }

        if (patched.value.meta.groups !== null && patched.value.meta.groups?.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Kies minstens één leeftijdsgroep.',
            });
        }
        // #endregion

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;

        if (props.isNew) {
            arr.addPut(patched.value);
        }
        else {
            arr.addPatch(patch.value);
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/events',
            body: arr,
            decoder: new ArrayDecoder(Event as Decoder<Event>),
        });

        Toast.success($t('dced31f7-3554-425d-bae9-85416e3742d6')).show();

        // Make sure original event is patched
        deepSetArray([props.event], response.data);

        props.callback?.();

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
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
                            group: patch,
                        });
                    },
                    deleteHandler: async () => {
                        addPatch({
                            group: null,
                        });
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
    else {
        const organizationId = patched.value.organizationId ?? undefined;
        const group = Group.create({
            organizationId,
            periodId: externalOrganization.value?.period.period.id ?? organization.value?.period.period.id,
            type: GroupType.EventRegistration,
            settings: GroupSettings.create({
                name: patched.value.name,
                allowRegistrationsByOrganization: isNationalActivity.value,
            }),
        });

        if (!organizationId) {
            // Kies een organisator
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(SearchOrganizationView, {
                            title: 'Kies een organisator van deze inschrijvingen',
                            description: 'Voor nationale activiteiten moet je kiezen via welke groep alle betalingen verlopen. De betaalinstellingen van die groep worden dan gebruikt en alle inschrijvingen worden dan ingeboekt in de boekhouding van die groep.\n\nDaarnaast bepaalt de organisator ook instellingen die invloed hebben op de dataverzameling en andere subtielere zaken.',
                            selectOrganization: async (organization: Organization, navigation: NavigationActions) => {
                                group.organizationId = organization.id;
                                group.periodId = organization.period.period.id;
                                await navigation.show({
                                    force: true,
                                    replace: 1,
                                    components: [
                                        new ComponentWithProperties(EditGroupView, {
                                            group: group,
                                            isNew: true,
                                            isMultiOrganization: isNationalActivity.value,
                                            showToasts: false,
                                            saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                                                addPatch({
                                                    group: group.patch(patch),
                                                });
                                            },
                                        }),
                                    ],
                                });
                            },
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
            return;
        }

        // Edit the group
        await present({
            components: [
                new ComponentWithProperties(EditGroupView, {
                    group: group,
                    isNew: true,
                    isMultiOrganization: isNationalActivity.value,
                    showToasts: false,
                    saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                        addPatch({
                            group: group.patch(patch),
                        });
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
}

async function deleteMe() {
    if (saving.value || deleting.value) {
        return;
    }

    const confirmationCode = name.value;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: $t('14a63393-32e4-448b-8cb5-aa0e0629667b'),
                description: $t('52312517-de77-4dd5-8c77-cef97c573578'),
                confirmationTitle: $t('b584fc1c-6b13-442b-b2cc-f59e39fea6e7'),
                confirmationPlaceholder: $t('deb2a251-2eab-4132-849e-6b1a8bc87300'),
                confirmationCode,
                checkboxText: $t('4a1ad6f2-d061-4fe0-8206-8540442ad038'),
                onDelete: async () => {
                    deleting.value = true;

                    try {
                        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
                        arr.addDelete(props.event.id);

                        await context.value.authenticatedServer.request({
                            method: 'PATCH',
                            path: '/events',
                            body: arr,
                            decoder: new ArrayDecoder(Event as Decoder<Event>),
                        });

                        GlobalEventBus.sendEvent('event-deleted', props.event).catch(console.error);

                        Toast.success($t('50df35d9-992f-4697-9150-aa8643ee4f18')).show();
                        props.callback?.();
                        await pop({ force: true });
                    }
                    catch (e) {
                        errors.errorBox = new ErrorBox(e);
                    }

                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
