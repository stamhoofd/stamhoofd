<template>
    <SaveView :title="title" :disabled="!hasChanges" :loading="saving" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <template #buttons>
            <button v-if="!isNew" class="button icon history" type="button" @click="viewAudit" />
        </template>
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('c0a0c0f7-1282-40be-85fc-320d136d34ab')" error-fields="name" :error-box="errors.errorBox">
                <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('c0a0c0f7-1282-40be-85fc-320d136d34ab')" autocomplete="off" enterkeyhint="next">
            </STInputBox>

            <STInputBox v-if="platform.config.eventTypes.length" error-fields="type" :error-box="errors.errorBox" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                <Dropdown v-model="typeId">
                    <option v-for="t of platform.config.eventTypes" :key="t.id" :value="t.id">
                        {{ t.name }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>
        <p v-if="type" class="style-description-block">
            {{ type.description }}
        </p>

        <STInputBox :title="$t('561e9ebb-ae0c-48f3-a10d-921c2a59d5a4')" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="description" :placeholder="$t('2cb56415-5e16-4a75-9012-8971be8dbc6a')" />
        </STInputBox>

        <hr><h2>{{ $t('112b7686-dffc-4ae9-9706-e3efcd34898f') }}</h2>

        <Checkbox v-if="!type || (type.maximumDays !== 1 && (type.minimumDays ?? 1) <= 1)" v-model="multipleDays">
            {{ $t('f001f5c4-f3ea-46c0-bd0c-0b30ad8098f5') }}
        </Checkbox>

        <div class="split-inputs">
            <STInputBox :title="multipleDays ? $t(`33a674c2-6981-442b-9bd4-01f71da7a159`) : $t(`40aabd99-0331-4267-9b6a-a87c06b3f7fe`)" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="multipleDays" v-model="startDate" :title="$t('5dd84548-b16f-415b-8dbd-d96aeecedc3e')" :validator="errors.validator" />
        </div>

        <div class="split-inputs">
            <STInputBox v-if="multipleDays || (type && type.minimumDays !== null && type.minimumDays > 1)" error-fields="endDate" :error-box="errors.errorBox" :title="$t(`f852932e-380e-4b9a-916b-2bc008d8c08a`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-else v-model="startDate" :title="$t('5dd84548-b16f-415b-8dbd-d96aeecedc3e')" :validator="errors.validator" />
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`91310731-bddd-4ad3-b5fb-182237699f20`)" />
        </div>

        <hr><h2>{{ $t('bf2af52c-de5d-4089-b46d-9be48594cdb4') }}</h2>

        <STList>
            <STListItem v-if="canSetNationalActivity || isNationalActivity" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="isNationalActivity" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('d756277c-4655-4e92-afcc-ae3c9f615190') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="visible" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('987c7ee6-8ee2-41d7-823e-db0ff590ea7d') }}
                </h3>
            </STListItem>
        </STList>

        <template v-if="canSetNationalActivity && externalOrganization">
            <hr><h2>{{ $t('e4d49374-df2a-4fd7-863e-4a577e285cdc') }}</h2>
            <p>{{ $t('f675d723-b1b9-4abd-9e7c-0459c24e474b') }}</p>

            <STList>
                <STListItem v-if="externalOrganization" :selectable="!organization" @click="organization ? undefined : chooseOrganizer($t('ab00e79e-c7cb-4595-9119-4fb5ca366dd1'), canSelectOrganization)">
                    <template #left>
                        <OrganizationAvatar :organization="externalOrganization" />
                    </template>

                    <h3 class="style-title-list">
                        {{ externalOrganization.name }}
                    </h3>

                    <template v-if="!organization" #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>

        <JumpToContainer :visible="isNationalActivity && organizationTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('2faa00db-5af7-4556-ac49-5b15abf2182f') }}</div>
                <div>
                    <button v-if="!hasTagRestrictions" type="button" class="button icon trash" @click="deleteTagRestriction" />
                </div>
            </h2>
            <p>{{ $t('7335fc4d-f993-415c-976b-f32af724907e') }}</p>

            <TagIdsInput v-model="organizationTagIds" :is-tag-enabled-predicate="isTagEnabledPredicate" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('9af957c4-5dea-47ee-a30f-1ef5802a9437') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteDefaultAgeGroupRestriction" />
                </div>
            </h2>

            <p>{{ $t('712c3597-d7c9-459c-9e92-ff32de445642') }}</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="groups !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('efeed776-7b4a-4f06-b755-04b1c615ff2d') }}</div>
                <div>
                    <button v-if="!hasGroupRestrictions" type="button" class="button icon trash" @click="deleteGroupsRestriction" />
                </div>
            </h2>

            <p>{{ $t('248d7837-f7f1-48f9-a151-96e936cda4fc') }}</p>

            <p v-if="!organization || !externalOrganization || externalOrganization?.id !== organization.id" class="info-box">
                {{ $t('fb25250b-2b50-4fb4-babc-020b9fe80dfc') }}
            </p>
            <GroupsInput v-else v-model="groups" :date="startDate" :is-group-enabled-operator="isGroupEnabledOperator" />
        </JumpToContainer>

        <JumpToContainer :visible="!!location">
            <hr><h2 class="style-with-button">
                <div>{{ $t('8922afd5-4566-4998-9c6f-d7a6143f29a2') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteLocation" />
                </div>
            </h2>

            <STInputBox :title="$t('3db5bf3f-3eb5-4cfc-ba9b-429fab43c540')" error-fields="location.name" :error-box="errors.errorBox">
                <input ref="firstInput" v-model="locationName" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`e32f1f4e-e834-47a1-a7cb-a807170b6871`)">
            </STInputBox>

            <AddressInput v-model="locationAddress" :nullable="true" :required="isLocationRequired" :validator="errors.validator" :title="$t(`5e85d1ac-98a4-4cfb-a0ce-f06e427d73b3`)" />
        </JumpToContainer>

        <JumpToContainer :visible="!!coverPhoto">
            <hr><h2 class="style-with-button">
                <div>{{ $t('17d579e1-518b-4dd4-98d8-f8184b7287be') }}</div>
                <div>
                    <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                        <span class="icon trash" />
                        <span>{{ $t('ffef2405-f472-416b-b8fa-372fdf694797') }}</span>
                    </button>
                    <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="resolutions" />
                </div>
            </h2>

            <ImageComponent :image="coverPhoto" :auto-height="true" />
        </JumpToContainer>

        <JumpToContainer :visible="forceShowAge || minAge !== null || maxAge !== null">
            <hr>
            <h2>{{ $t('3bd7031d-eb6b-4efc-97f7-53adfcff054a') }}</h2>

            <div class="split-inputs">
                <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`7d708b33-f1a6-4b95-b0a7-717a8e5a9e07`)">
                    <AgeInput v-model="minAge" :year="event.startDate.getFullYear()" :nullable="true" :placeholder="$t(`f5f56168-1922-4a23-b376-20a7738bfa66`)" />
                </STInputBox>

                <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`c0cab705-c129-4a72-8860-c33ef91ec630`)">
                    <AgeInput v-model="maxAge" :year="event.startDate.getFullYear()" :nullable="true" :placeholder="$t(`f5f56168-1922-4a23-b376-20a7738bfa66`)" />
                </STInputBox>
            </div>
            <p class="style-description-small">
                *{{ $t('912639c7-e301-463e-b2d3-16b912848330') }}{{ event.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                    {{ $t('49030aa4-f77c-4db5-b976-2125675aae66') }}
                </template>
            </p>
        </JumpToContainer>

        <hr><STList>
            <STListItem v-if="defaultAgeGroupIds === null && isNationalActivity" :selectable="true" element-name="button" @click="addDefaultAgeGroupRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('5283efe2-f4a8-4c3b-8cbc-7cf2acf16da0') }}
                </h3>
            </STListItem>

            <STListItem v-if="!isNationalActivity && externalOrganization && organization && organization.id === externalOrganization.id && groups === null && !hasGroupRestrictions" :selectable="true" element-name="button" @click="addGroupsRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('97bfc084-7f4f-4e4f-a187-48703d42c7be') }}
                </h3>
            </STListItem>

            <STListItem v-if="isNationalActivity && organizationTagIds === null" :selectable="true" element-name="button" @click="addTagRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('5ba7cf31-0cee-4599-9086-ae864b09f441') }}
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

            <STListItem v-if="!(forceShowAge || minAge !== null || maxAge !== null)" :selectable="true" element-name="button" @click="addAgeRestriction">
                <template #left>
                    <span class="icon membership-filled gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('a0391aa7-d4f3-4ee7-af13-61e83124a6da') }}
                </h3>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AddressInput, AgeInput, AuditLogsView, CenteredMessage, DateSelection, Dropdown, ErrorBox, GlobalEventBus, ImageComponent, OrganizationAvatar, TagIdsInput, TimeInput, Toast, UploadButton, useExternalOrganization, WYSIWYGTextInput } from '@stamhoofd/components';
import { AccessRight, Country, Event, EventLocation, EventMeta, Organization, PermissionsResourceType, ResolutionRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch, watchEffect } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useAuth, useContext, useOrganization, usePatch, usePlatform } from '../hooks';
import DefaultAgeGroupIdsInput from '../inputs/DefaultAgeGroupIdsInput.vue';
import GroupsInput from '../inputs/GroupsInput.vue';
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
const title = computed(() => props.isNew ? $t(`008c80e4-a46f-4e1c-8f45-d383008b2e10`) : $t(`e4bff2f3-d273-4755-b617-f792a01f8325`));
const saving = ref(false);
const deleting = ref(false);
const forceShowAge = ref(props.event.meta.minAge !== null || props.event.meta.maxAge !== null);

const context = useContext();
const pop = usePop();
const organization = useOrganization();
const present = usePresent();
const platform = usePlatform();
const eventPermissions = useEventPermissions();
const patchedPeriod = computed(() => organization.value?.period.period ?? platform.value.period);

const { externalOrganization, choose: chooseOrganizer } = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: organizationId => addPatch({
            organizationId,
        }),
    }),
);

async function viewAudit() {
    await present({
        components: [
            new ComponentWithProperties(AuditLogsView, {
                objectIds: [props.event.id],
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

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

const minAge = computed({
    get: () => patched.value.meta.minAge,
    set: minAge => addPatch({
        meta: EventMeta.patch({
            minAge,
        }),
    }),
});

const maxAge = computed({
    get: () => patched.value.meta.maxAge,
    set: maxAge => addPatch({
        meta: EventMeta.patch({
            maxAge,
        }),
    }),
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

const auth = useAuth();
const canSetNationalActivity = computed(() => auth.platformPermissions?.hasAccessRightForSomeResourceOfType(PermissionsResourceType.OrganizationTags, AccessRight.EventWrite));
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
                chooseOrganizer($t(`271299b8-7b44-40b8-a4ce-e345abf164cb`), canSelectOrganization).catch(console.error);
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

const canSelectOrganization = (o: Organization) => {
    const result = eventPermissions.canAdminEventForExternalOrganization(o);
    if (!result) {
        Toast.error($t('43ff8e32-1a0b-41cf-b9a6-8e4c85d12739'))
            .show();
        return false;
    }

    if (organization.value && o.id !== organization.value.id) {
        Toast.error($t('13a4b7fa-7de6-497e-9e7c-6aee4f783260'))
            .show();
        return false;
    }

    return true;
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

function addAgeRestriction() {
    forceShowAge.value = true;
}

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
                    message: $t(`382fab7a-2276-4aac-a785-7dac7dcc2b20`),
                    field: 'event_required',
                });
            }
        }

        if (patched.value.meta.groups !== null && patched.value.meta.groups?.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`222eb3ab-1e8d-4530-9636-0bf5525a9159`),
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
