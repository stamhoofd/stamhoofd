<template>
    <SaveView :title="title" :disabled="!hasChanges" :loading="saving" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <template #buttons v-if="!isNew">
            <button class="button icon history" type="button" @click="viewAudit" />
        </template>
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%Gq')" error-fields="name" :error-box="errors.errorBox">
                <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('%Gq')" autocomplete="off" enterkeyhint="next">
            </STInputBox>

            <STInputBox v-if="platform.config.eventTypes.length" error-fields="type" :error-box="errors.errorBox" :title="$t(`%1B`)">
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

        <STInputBox :title="$t('%6o')" error-fields="meta.description" :error-box="errors.errorBox" class="max">
            <WYSIWYGTextInput v-model="description" :placeholder="$t('%7Q')" />
        </STInputBox>

        <hr><h2>{{ $t('%7R') }}</h2>

        <Checkbox v-if="!type || (type.maximumDays !== 1 && (type.minimumDays ?? 1) <= 1)" v-model="multipleDays">
            {{ $t('%7S') }}
        </Checkbox>

        <div class="split-inputs">
            <STInputBox :title="multipleDays ? $t(`%7e`) : $t(`%7R`)" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="multipleDays" v-model="startDate" :title="$t('%5M')" :validator="errors.validator" />
        </div>

        <div class="split-inputs">
            <STInputBox v-if="multipleDays || (type && type.minimumDays !== null && type.minimumDays > 1)" error-fields="endDate" :error-box="errors.errorBox" :title="$t(`%wB`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-else v-model="startDate" :title="$t('%5M')" :validator="errors.validator" />
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`%ze`)" />
        </div>

        <hr><h2>{{ $t('%1CP') }}</h2>

        <STList>
            <STListItem v-if="canSetNationalActivity || isNationalActivity" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="isNationalActivity" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%7T') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="visible" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%7U') }}
                </h3>
            </STListItem>
        </STList>

        <template v-if="canSetNationalActivity && externalOrganization">
            <hr><h2>{{ $t('%16T') }}</h2>
            <p>{{ $t('%16U') }}</p>

            <STList>
                <STListItem v-if="externalOrganization" :selectable="!organization" @click="organization ? undefined : chooseOrganizer($t('%16V'), canSelectOrganization)">
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
                <div>{{ $t('%ae') }}</div>
                <div>
                    <button v-if="!hasTagRestrictions" type="button" class="button icon trash" @click="deleteTagRestriction" />
                </div>
            </h2>
            <p>{{ $t('%af') }}</p>

            <TagIdsInput v-model="organizationTagIds" :is-tag-enabled-predicate="isTagEnabledPredicate" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%3M') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteDefaultAgeGroupRestriction" />
                </div>
            </h2>

            <p>{{ $t('%7I') }}</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="groups !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%P4') }}</div>
                <div>
                    <button v-if="!hasGroupRestrictions" type="button" class="button icon trash" @click="deleteGroupsRestriction" />
                </div>
            </h2>

            <p>{{ $t('%7J') }}</p>

            <p v-if="!organization || !externalOrganization || externalOrganization?.id !== organization.id" class="info-box">
                {{ $t('%7K') }}
            </p>
            <GroupsInput v-else v-model="groups" :date="startDate" :is-group-enabled-operator="isGroupEnabledOperator" />
        </JumpToContainer>

        <JumpToContainer :visible="!!location">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%TW') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteLocation" />
                </div>
            </h2>

            <STInputBox :title="$t('%7L')" error-fields="location.name" :error-box="errors.errorBox">
                <input ref="firstInput" v-model="locationName" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`%U5`)">
            </STInputBox>

            <AddressInput v-model="locationAddress" :nullable="true" :required="isLocationRequired" :validator="errors.validator" :title="$t(`%U6`)" />
        </JumpToContainer>

        <JumpToContainer :visible="!!coverPhoto">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%7M') }}</div>
                <div>
                    <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                        <span class="icon trash" />
                        <span>{{ $t('%CJ') }}</span>
                    </button>
                    <UploadButton v-model="coverPhoto" :text="coverPhoto ? $t(`%He`) : $t(`%Hf`)" :resolutions="resolutions" />
                </div>
            </h2>

            <ImageComponent :image="coverPhoto" :auto-height="true" />
        </JumpToContainer>

        <JumpToContainer :visible="forceShowAge || minAge !== null || maxAge !== null">
            <hr>
            <h2>{{ $t('%1Fv') }}</h2>

            <div class="split-inputs">
                <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`%Hm`)">
                    <AgeInput v-model="minAge" :year="event.startDate.getFullYear()" :nullable="true" :placeholder="$t(`%4a`)" />
                </STInputBox>

                <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`%Hn`)">
                    <AgeInput v-model="maxAge" :year="event.startDate.getFullYear()" :nullable="true" :placeholder="$t(`%4a`)" />
                </STInputBox>
            </div>
            <p class="style-description-small">
                *{{ $t('%cX') }}{{ event.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                    {{ $t('%cY') }}
                </template>
            </p>
        </JumpToContainer>

        <hr><STList>
            <STListItem v-if="defaultAgeGroupIds === null && isNationalActivity" :selectable="true" element-name="button" @click="addDefaultAgeGroupRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%7N') }}
                </h3>
            </STListItem>

            <STListItem v-if="!isNationalActivity && externalOrganization && organization && organization.id === externalOrganization.id && groups === null && !hasGroupRestrictions" :selectable="true" element-name="button" @click="addGroupsRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%7O') }}
                </h3>
            </STListItem>

            <STListItem v-if="isNationalActivity && organizationTagIds === null" :selectable="true" element-name="button" @click="addTagRestriction">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%7P') }}
                </h3>
            </STListItem>

            <STListItem v-if="!location" :selectable="true" element-name="button" @click="addLocation">
                <template #left>
                    <span class="icon location gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%4S') }}
                </h3>
            </STListItem>

            <STListItem v-if="!coverPhoto" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="coverPhoto" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('%4Z') }}
                    </h3>
                </UploadButton>
            </STListItem>

            <STListItem v-if="!(forceShowAge || minAge !== null || maxAge !== null)" :selectable="true" element-name="button" @click="addAgeRestriction">
                <template #left>
                    <span class="icon membership-filled gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1Fw') }}
                </h3>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import AddressInput from '#inputs/AddressInput.vue';
import AgeInput from '#inputs/AgeInput.vue';
import AuditLogsView from '#audit-logs/AuditLogsView.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import DateSelection from '#inputs/DateSelection.vue';
import Dropdown from '#inputs/Dropdown.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { GlobalEventBus } from '#EventBus.ts';
import ImageComponent from '#views/ImageComponent.vue';
import OrganizationAvatar from '#context/OrganizationAvatar.vue';
import TagIdsInput from '#inputs/TagIdsInput.vue';
import TimeInput from '#inputs/TimeInput.vue';
import { Toast } from '#overlays/Toast.ts';
import UploadButton from '#inputs/UploadButton.vue';
import { useExternalOrganization } from '#groups/hooks/useExternalOrganization.ts';
import WYSIWYGTextInput from '#inputs/WYSIWYGTextInput.vue';
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
const title = computed(() => props.isNew ? $t(`%vO`) : $t(`%vP`));
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
                chooseOrganizer($t(`%16W`), canSelectOrganization).catch(console.error);
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
        Toast.error($t('%CM'))
            .show();
        return false;
    }

    if (organization.value && o.id !== organization.value.id) {
        Toast.error($t('%CN'))
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
                    message: $t(`%vQ`),
                    field: 'event_required',
                });
            }
        }

        if (patched.value.meta.groups !== null && patched.value.meta.groups?.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`%vR`),
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

        Toast.success($t('%5F')).show();

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
                title: $t('%6L'),
                description: $t('%6M'),
                confirmationTitle: $t('%6N'),
                confirmationPlaceholder: $t('%6O'),
                confirmationCode,
                checkboxText: $t('%6P'),
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

                        Toast.success($t('%4G')).show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
