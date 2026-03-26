<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('%9N') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-for="n in names.length" :key="n" :title="$t(`%Gq`) + ' '+n">
            <input class="input" type="text" autocomplete="off" :value="getName(n - 1)" :placeholder="$t(`%Hk`) + ' '+n" @input="setName(n - 1, ($event as any).target.value)"><template #right>
                <button v-if="names.length > 1" class="button icon trash gray" type="button" @click="deleteName(n - 1)" />
            </template>
        </STInputBox>

        <button class="button text" type="button" @click="addName">
            <span class="icon add" />
            <span>{{ $t('%Hk') }}</span>
        </button>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`%Hl`)" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%9O') }}
        </p>

        <hr><h2>{{ $t('%9P') }}</h2>
        <p>{{ $t('%9Q') }}</p>

        <STInputBox :title="$t('%7g')" error-fields="defaultMembershipTypeId" :error-box="errors.errorBox">
            <Dropdown v-model="defaultMembershipTypeId">
                <option :value="null">
                    {{ $t('%9R') }}
                </option>
                <option v-for="membershipType of membershipTypes" :key="membershipType.id" :value="membershipType.id">
                    {{ membershipType.name }}
                </option>
            </Dropdown>
        </STInputBox>

        <hr><h2>{{ $t('%9S') }}</h2>
        <p>{{ $t('%9T') }}</p>

        <div class="split-inputs">
            <STInputBox error-fields="minAge" :error-box="errors.errorBox" :title="$t(`%Hm`)">
                <AgeInput v-model="minAge" :year="startYear" :nullable="true" :placeholder="$t(`%4a`)" />
            </STInputBox>

            <STInputBox error-fields="maxAge" :error-box="errors.errorBox" :title="$t(`%Hn`)">
                <AgeInput v-model="maxAge" :year="startYear" :nullable="true" :placeholder="$t(`%4a`)" />
            </STInputBox>
        </div>
        <p class="style-description-small">
            {{ $t('%9U', {startYear: startYear.toString()}) }}
        </p>

        <hr><h2>{{ $t('%9V') }}</h2>

        <div class="split-inputs">
            <NumberInputBox v-model="minimumRequiredMembers" error-fields="minimumRequiredMembers" :error-box="errors.errorBox" :title="$t(`%Ho`)" :required="true" suffix="leden" suffix-singular="lid" :placeholder="$t(`%1FW`)" :validator="errors.validator" />
        </div>

        <div class="container">
            <hr><STList v-if="organizationTagIds === null">
                <STListItem :selectable="true" element-name="button" @click="organizationTagIds = []">
                    <template #left>
                        <span class="icon add gray" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%9W') }}
                    </h3>
                </STListItem>
            </STList>
            <template v-else>
                <h2 class="style-with-button">
                    <div>{{ $t('%wP') }}</div>
                    <div>
                        <button type="button" class="button icon trash" @click="organizationTagIds = null" />
                    </div>
                </h2>
                <p>{{ $t('%9X') }}</p>
                <TagIdsInput v-model="organizationTagIds" :validator="errors.validator" />
            </template>
        </div>

        <hr><h2>{{ $t('%HL') }}</h2>
        <p>{{ $t('%9Y') }}</p>

        <InheritedRecordsConfigurationBox :group-level="true" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import AgeInput from '@stamhoofd/components/inputs/AgeInput.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import TagIdsInput from '@stamhoofd/components/inputs/TagIdsInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import InheritedRecordsConfigurationBox from '@stamhoofd/components/records/components/InheritedRecordsConfigurationBox.vue';
import type { DefaultAgeGroup } from '@stamhoofd/structures';
import { OrganizationRecordsConfiguration, PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
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
const title = computed(() => props.isNew ? $t('%7A') : $t('%7B'));
const pop = usePop();

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
                message: $t('%56'),
                field: 'name',
            });
        }

        if (names.value[0].length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('%56'),
                field: 'name',
            });
        }
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
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
        $t('%9Z'),
        $t('%CJ'),
        $t('%9a'),
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
        forceDefaultAgeGroup: true,
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
