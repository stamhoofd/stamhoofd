<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('aa80abe5-2f1a-448d-b98c-0c38ece581d6') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-for="n in names.length" :key="n" :title="'Naam '+n">
            <input
                class="input"
                type="text"
                autocomplete="off"
                :value="getName(n - 1)" :placeholder="'Synoniem '+n" @input="setName(n - 1, ($event as any).target.value)"
            >

            <template #right>
                <button v-if="names.length > 1" class="button icon trash gray" type="button" @click="deleteName(n - 1)" />
            </template>
        </STInputBox>

        <button class="button text" type="button" @click="addName">
            <span class="icon add" />
            <span>Synoniem</span>
        </button>

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Korte tip voor hoe deze standaard leeftijdsgroep gebruikt kan worden"
                autocomplete="off"
            />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('4f96c821-c032-4772-8d6a-55cf0c8354d1') }}
        </p>

        <hr>
        <h2>{{ $t('bb2ff811-dae0-4322-975f-793de13d471a') }}</h2>
        <p>{{ $t('6af3e1d3-802c-4cf3-923e-33faacfd2e16') }}</p>

        <STInputBox :title="$t('61f434a9-49e6-4a92-b613-965dfd807dca')" error-fields="defaultMembershipTypeId" :error-box="errors.errorBox">
            <Dropdown v-model="defaultMembershipTypeId">
                <option :value="null">
                    {{ $t('10df6cbf-4609-4677-8791-4ffa38e31699') }}
                </option>
                <option v-for="membershipType of membershipTypes" :key="membershipType.id" :value="membershipType.id">
                    {{ membershipType.name }}
                </option>
            </Dropdown>
        </STInputBox>

        <hr>
        <h2>{{ $t('8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754') }}</h2>
        <p>{{ $t('4be45e47-0ee2-43cd-b719-8a60513f0965') }}</p>

        <div class="split-inputs">
            <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="minAge" :error-box="errors.errorBox">
                <AgeInput v-model="minAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>

            <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="maxAge" :error-box="errors.errorBox">
                <AgeInput v-model="maxAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>
        </div>
        <p class="st-list-description">
            {{ $t('ea927f14-835b-43f6-bf6e-3e689b5a0824', {startYear: startYear.toString()}) }}
        </p>

        <hr>
        <h2>{{ $t('c6c8e406-3d1f-41c4-b3df-d0b1e8661040') }}</h2>

        <div class="split-inputs">
            <STInputBox title="Minimum aantal leden" error-fields="minimumRequiredMembers" :error-box="errors.errorBox">
                <NumberInput v-model="minimumRequiredMembers" placeholder="Geen" :required="true" suffix="leden" suffix-singular="lid" />
            </STInputBox>
        </div>

        <div class="container">
            <hr>

            <STList v-if="organizationTagIds === null">
                <STListItem :selectable="true" element-name="button" @click="organizationTagIds = []">
                    <template #left>
                        <span class="icon add gray" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('18a41eda-92fd-46a6-acc1-fc35536b86b4') }}
                    </h3>
                </STListItem>
            </STList>
            <template v-else>
                <h2 class="style-with-button">
                    <div>{{ $t('348c29be-b166-497b-be15-d9522a2dc2fb') }}</div>
                    <div>
                        <button type="button" class="button icon trash" @click="organizationTagIds = null" />
                    </div>
                </h2>
                <p>{{ $t('5d1da89a-aa00-4953-aa59-53c0342c5c1a') }}</p>
                <TagIdsInput v-model="organizationTagIds" :validator="errors.validator" />
            </template>
        </div>

        <hr>
        <h2>{{ $t('070cf05d-b582-4f6a-b153-48f5f3ecc9fe') }}</h2>
        <p>{{ $t('f9c9433c-24fd-4645-b5df-966f9d076b1b') }}</p>

        <InheritedRecordsConfigurationBox :group-level="true" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { AgeInput, CenteredMessage, Dropdown, ErrorBox, InheritedRecordsConfigurationBox, NumberInput, SaveView, TagIdsInput, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { DefaultAgeGroup, OrganizationRecordsConfiguration, PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    group: DefaultAgeGroup;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<DefaultAgeGroup>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('9cff0038-a8c2-49bd-9353-fab8308a83ad') : $t('b486463a-3a65-4fca-b7cb-e3e93b0cfe4b'));
const pop = usePop();
const $t = useTranslate();
const platform = usePlatform();
const membershipTypes = computed(() => platform.value.config.membershipTypes.filter(t => t.behaviour === PlatformMembershipTypeBehaviour.Period));

const { patched, addPatch, hasChanges, patch } = usePatch(props.group);
let startYear = new Date().getFullYear();
const month = new Date().getMonth();

if (month < 7) {
    startYear--;
}

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (names.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('ea9baa7a-c2c8-4207-a300-9de4b145f6ca'),
                field: 'name',
            });
        }

        if (names.value[0].length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('ea9baa7a-c2c8-4207-a300-9de4b145f6ca'),
                field: 'name',
            });
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm(
        $t('e5ca0b55-20c6-4523-89b6-1ecba10d95b7'),
        $t('6e3da050-6679-4475-a858-77b5b02b6fa4'),
        $t('8997d560-a0c6-422b-a988-6186e8ed64be'),
    )) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const names = computed({
    get: () => patched.value.names,
    set: names => addPatch({ names: names as any }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const minAge = computed({
    get: () => patched.value.minAge,
    set: minAge => addPatch({ minAge }),
});

const maxAge = computed({
    get: () => patched.value.maxAge,
    set: maxAge => addPatch({ maxAge }),
});

const defaultMembershipTypeId = computed({
    get: () => patched.value.defaultMembershipTypeId,
    set: defaultMembershipTypeId => addPatch({ defaultMembershipTypeId }),
});

const minimumRequiredMembers = computed({
    get: () => patched.value.minimumRequiredMembers,
    set: minimumRequiredMembers => addPatch({ minimumRequiredMembers }),
});

const recordsConfiguration = computed(() => patched.value.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        recordsConfiguration,
    });
};

const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
    });
});

const organizationTagIds = computed({
    get: () => patched.value.organizationTagIds,
    set: (organizationTagIds: string[] | null) => addPatch({
        organizationTagIds: organizationTagIds as any,
    }),
});

function getName(index: number) {
    return names.value[index] ?? '';
}

function setName(index: number, value: string) {
    const newNames = [...names.value];
    newNames[index] = value;
    names.value = newNames;
}

function deleteName(index: number) {
    const newNames = [...names.value];
    newNames.splice(index, 1);
    names.value = newNames;
}

function addName() {
    names.value = [...names.value, ''];
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
