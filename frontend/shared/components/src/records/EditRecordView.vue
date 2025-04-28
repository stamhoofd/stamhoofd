<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            {{ $t('8485e7ea-6d66-4f2c-b92a-bd44cb2f4eb4') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('0487c3b0-3f93-4344-a34a-9a9198f37023') }}</a> {{ $t('0759d023-2306-4601-911e-5af949960753') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <TInput v-model="name" error-fields="name" :placeholder="$t(`79e3b4c3-e117-4907-942b-a0e06e01a573`)" :error-box="errors.errorBox" :title="$t(`21d2abc5-55c1-4ad2-a7ba-44061fae2fd1`)" />
            </div>

            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                    <Dropdown v-model="type">
                        <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                            <option v-for="_type in group.values" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type === RecordType.File" error-fields="fileType" :error-box="errors.errorBox" :title="$t(`af55bdcd-8177-4560-ab5a-f45adb52d87c`)">
                    <Dropdown v-model="fileType">
                        <option v-for="item in availableFileTypes" :key="item.value || 'null'" :value="item.value">
                            {{ item.name }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
        </div>

        <Checkbox v-model="required">
            {{ requiredText }}
        </Checkbox>
        <Checkbox v-if="type === RecordType.Checkbox" v-model="askComments">
            {{ $t('3fd57fae-8af6-4ca4-b551-7b5dbefd1547') }}
        </Checkbox>

        <div v-if="type === RecordType.MultipleChoice || type === RecordType.ChooseOne" class="container">
            <hr><h2 class="style-with-button with-list">
                <div>{{ $t('84017949-ee42-4297-8fa2-f89b85e8cf40') }}</div>
                <div>
                    <button class="button text" type="button" @click="addChoice">
                        <span class="icon add" />
                        <span>{{ $t('e69989bf-c310-49b4-aff1-b9c84cfe5760') }}</span>
                    </button>
                </div>
            </h2>

            <STList v-if="patchedRecord.choices.length > 0" v-model="choices" :draggable="true">
                <template #item="{item: choice}">
                    <RecordChoiceRow :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch" />
                </template>
            </STList>

            <p v-else class="info-box">
                <span>{{ $t('8ba6ec31-c0f8-4104-aa4b-5169a7b43781') }} <span class="icon add middle" />{{ $t('2b6f5a92-33fe-4541-87ca-3677a9f44d9f') }}</span>
            </p>
        </div>

        <hr><h2 class="style-with-button">
            <div>{{ $t('3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d') }}</div>
            <div>
                <button class="button text" type="button" @click="openPreview">
                    <span class="icon eye" />
                    <span>{{ $t('38e2c1aa-13f6-4339-8cfd-68c2603beb51') }}</span>
                </button>
            </div>
        </h2>
        <p>{{ $t('46374fd8-2e04-4008-a437-ef8da0857400') }}</p>

        <TInput v-model="label" :title="labelTitle" error-fields="label" :error-box="errors.errorBox" class="max" :placeholder="name" />

        <TTextarea v-model="description" :title="descriptionTitle" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" error-fields="description" :error-box="errors.errorBox" class="max" />
        <p class="style-description-small">
            {{ $t('ee593263-9493-4a9c-a3e5-fe0a4e596887') }}
        </p>

        <TTextarea v-if="shouldAskInputPlaceholder" v-model="inputPlaceholder" :placeholder="$t(`4f04a0fd-f7f9-46b0-9fe0-3d4b443c7f37`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`111715d8-0347-4e60-80fc-e405999430ee`)" />
        <p class="style-description-small">
            {{ $t('9f3d1ce2-aa2e-421b-84f1-07e875e9e4a8') }}
        </p>

        <TTextarea v-if="shouldAskCommentsDescription" v-model="commentsDescription" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`5a3c9444-fcf0-408c-99fc-4e5395c37eb0`)" />
        <p v-if="shouldAskCommentsDescription" class="style-description-small">
            {{ $t('b8e94451-af94-47ac-8e2c-b39301d3e829') }}
        </p>

        <template v-if="showExternalPermissionLevel">
            <hr><h2>{{ $t('e5c00498-7be5-4dca-94e5-8f73edfcbda0') }}</h2>
            <p>{{ $t('78e39cfd-8a14-4db6-aeac-76976a40206f') }}</p>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.None" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('65893f5f-e4f6-487a-b0ea-077fe620cb31') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Read" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('103e19d1-d82d-4270-81f9-af4e7f33b13e') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Write" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('ad3ad207-6470-4f3e-aaf4-1ea5ea8b85ad') }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="canAddWarning">
            <hr><h2>{{ $t('509ab71d-f9e0-4f2a-8683-590b6363b32d') }}</h2>
            <p>{{ $t('5c832a65-7b8d-4e3d-a55d-291567ddb71a') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="null" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('7042e593-92bc-4166-9eff-8379f4d80754') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="false" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ warningNonInvertedText }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="true" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ warningInvertedText }}
                    </h3>
                </STListItem>
            </STList>

            <TTextarea v-if="warningText !== null" v-model="warningText" :placeholder="$t(`fd5e3142-7a0e-4305-8a49-35f2f4d89083`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`73dbf494-16a3-4e9a-8cbe-5170334209c0`)" />
            <STInputBox v-if="warningType" class="max" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Info" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('fd69163a-0141-4540-af7a-ef2b45682383') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('90eed78f-7d02-4433-ba89-42da46201282') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Warning" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('509ab71d-f9e0-4f2a-8683-590b6363b32d') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('aef8493c-6d75-4270-ba4c-f9f09b65caf7') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Error" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('b4714037-0561-4ce1-9601-9fd753fd9825') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t("e34424b4-80ff-46a2-987e-85f89cfd806c") }}
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <template v-if="settings.dataPermission">
            <hr><h2>{{ $t('3936222c-5399-4d5e-9543-e483fa4f058a') }}</h2>
            <p>
                {{ $t('30fe36de-4e4e-42e3-a2f9-7740b028b415') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                    {{ $t('d6386cef-8e84-4107-920a-03db17372613') }}
                </a>
            </p>

            <Checkbox v-model="sensitive">
                {{ $t('09121186-9d8a-4bbb-ad08-080bb8a2d29f') }}
            </Checkbox>
        </template>

        <div v-if="hasFilters" class="container">
            <hr><h2>{{ $t('6ba4f526-8b64-4902-903b-7cb176684151') }}</h2>

            <PropertyFilterInput v-model="filter" :allow-optional="false" :builder="filterBuilder" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, GroupUIFilterBuilder, PropertyFilterInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { FileType, ObjectWithRecords, PermissionLevel, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, TranslatedString } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditRecordChoiceView from './EditRecordChoiceView.vue';
import { RecordEditorSettings, RecordEditorType } from './RecordEditorSettings';
import PreviewRecordView from './components/PreviewRecordView.vue';
import RecordChoiceRow from './components/RecordChoiceRow.vue';

const props = withDefaults(defineProps<{
    record: RecordSettings;
    category?: RecordCategory | null;
    isNew: boolean;
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => void;
    settings: RecordEditorSettings<T>;
    rootCategories?: RecordCategory[];
}>(), {
    category: null,
    rootCategories: () => ([]),
});

const errors = useErrors();
const pop = usePop();
const present = usePresent();
const editorType = computed(() => props.settings.type);

const filterBuilder = computed(() => props.settings.filterBuilder(props.rootCategories));

const hasFilters = computed(() => {
    return filterBuilder.value instanceof GroupUIFilterBuilder && filterBuilder.value.builders.length > 1;
});

const { patch: patchRecord, patched: patchedRecord, addPatch, hasChanges } = usePatch(props.record);
const showExternalPermissionLevel = computed(() => editorType.value === RecordEditorType.PlatformMember);

const availableTypes = [
    {
        name: $t(`571437e8-8eee-4cdb-bbf8-39a6144bff8c`),
        values: [
            {
                value: RecordType.Text,
                name: $t(`668f1663-e8d1-4e1c-9397-32a1c2b70022`),
            },
            {
                value: RecordType.Textarea,
                name: $t(`99cf6d44-681c-450b-8c5c-74bc75ca0cde`),
            },
            {
                value: RecordType.Address,
                name: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`),
            },
            {
                value: RecordType.Email,
                name: $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`),
            },
            {
                value: RecordType.Phone,
                name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
            },
            {
                value: RecordType.Date,
                name: $t(`9ee1052c-9396-4d2d-8247-97dfb45099f6`),
            },
            {
                value: RecordType.Integer,
                name: $t(`b877974f-ec5a-4e92-8ad2-3169ece7da77`),
            },
            {
                value: RecordType.Price,
                name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
            },
        ],
    },
    {
        name: $t(`e6ce4fef-ea7e-4218-840e-9435cfaa9931`),
        values: [
            {
                value: RecordType.Checkbox,
                name: $t(`be247511-3af8-4006-b944-19db50d75a89`),
            },
            {
                value: RecordType.ChooseOne,
                name: $t(`0c57da32-95ac-4e64-a61a-0a7fa104294a`),
            },
            {
                value: RecordType.MultipleChoice,
                name: $t(`06f06102-d0a6-4b23-84b0-43d53fc87ca1`),
            },
        ],
    },
    {
        name: $t(`af8afc36-22de-4f22-8235-e1e8f5eef7ca`),
        values: [
            {
                value: RecordType.Image,
                name: $t(`15a3e04d-9fa1-414c-87aa-22c2bd1d39ac`),
            },
            {
                value: RecordType.File,
                name: $t(`108e2ee2-0c29-4f5e-9c34-b9030dd369b9`),
            },
        ],
    },
];

const availableFileTypes = [
    {
        name: $t(`4760e3ab-3cb5-4045-b252-ef923dc2bc9d`),
        value: null,
    },
    {
        name: 'PDF',
        value: FileType.PDF,
    },
    {
        name: 'Word',
        value: FileType.Word,
    },
    {
        name: 'Excel',
        value: FileType.Excel,
    },
];

const canAddWarning = computed(() => {
    if (editorType.value === RecordEditorType.Organization) {
        return false;
    }

    return patchedRecord.value.type === RecordType.Checkbox || patchedRecord.value.type === RecordType.Text || patchedRecord.value.type === RecordType.Textarea;
});

const warningNonInvertedText = computed(() => {
    if (patchedRecord.value.type === RecordType.Checkbox) {
        return $t(`eaea9adf-d1c8-48ab-b6e9-4cc8d68e2392`);
    }
    return $t(`87150a09-54be-4640-9203-74d0399f1e02`);
});

const warningInvertedText = computed(() => {
    if (patchedRecord.value.type === RecordType.Checkbox) {
        return $t(`deb80c9b-6f0d-4185-800f-79e419cc8943`);
    }
    return $t(`64b39ce3-9624-4a38-a669-90a50443876f`);
});

const title = computed(() => {
    if (props.isNew) {
        return $t(`dcfc3edf-b906-420d-ac49-d89886824de9`);
    }
    return $t(`6b58e96c-fbd3-4998-909d-ed25cc758818`);
});

const labelTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return $t(`fac8120c-d891-42e3-8383-090db955c8ca`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`13cac71a-fb4c-46b6-9f17-1a57c5da2420`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`13cac71a-fb4c-46b6-9f17-1a57c5da2420`);
    }
    return $t(`f019894f-69ad-4999-abc0-8682bd024827`);
});

const descriptionTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return $t(`fa02d08e-aa63-41f0-b9d4-360011c0690d`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`33b05ed3-efea-4993-83a1-9c855f6ba427`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`33b05ed3-efea-4993-83a1-9c855f6ba427`);
    }
    return $t(`4dd7660f-3a18-4791-87b9-0e47115148f0`);
});

const name = computed({
    get: () => patchedRecord.value.name,
    set: (name) => {
        addPatch({ name });
    },
});

const fileType = computed({
    get: () => patchedRecord.value.fileType ?? null,
    set: (fileType) => {
        addPatch({ fileType });
    },
});

const label = computed({
    get: () => patchedRecord.value.label,
    set: (label) => {
        addPatch({ label });
    },
});

const required = computed({
    get: () => patchedRecord.value.required,
    set: (required: boolean) => {
        addPatch({ required });
    },
});

const choices = computed({
    get: () => patchedRecord.value.choices,
    set: (choices: RecordChoice[]) => {
        addPatch({ choices: choices as any });
    },
});

const inputPlaceholder = computed({
    get: () => patchedRecord.value.inputPlaceholder,
    set: (inputPlaceholder) => {
        addPatch({ inputPlaceholder });
    },
});

const askComments = computed({
    get: () => patchedRecord.value.askComments,
    set: (askComments: boolean) => {
        addPatch({ askComments });
    },
});

const filter = computed({
    get: () => patchedRecord.value.filter ?? PropertyFilter.createDefault(),
    set: (filter) => {
        addPatch({ filter });
    },
});

const shouldAskInput = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return askComments.value;
    }
    if (type.value === RecordType.MultipleChoice) {
        return false;
    }
    if (type.value === RecordType.ChooseOne) {
        return false;
    }
    return true;
});

const shouldAskInputPlaceholder = computed(() => {
    if (!shouldAskInput.value) {
        return false;
    }
    if (type.value === RecordType.Address) {
        return false;
    }
    return true;
});

const shouldAskCommentsDescription = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return askComments.value;
    }
    return false;
});

const requiredText = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return $t(`8499aa55-27b9-430a-b10e-c356a685d499`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`40bbc5f7-2295-4c7a-a280-3a7b3d6ae8db`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`3e726684-099f-4229-8d45-d1bfe0d21d07`);
    }
    return $t(`0169f40b-45fd-4552-979d-095381626df1`);
});

const type = computed({
    get: () => patchedRecord.value.type,
    set: (type: RecordType) => {
        patchRecord.value = patchRecord.value.patch({
            type,
            // Set required if not checkbox or multiple choice, and if the type changed
            required: (type !== RecordType.MultipleChoice && type !== RecordType.Checkbox) && props.record.type !== type
                ? true
                : ((type === RecordType.Checkbox || type === RecordType.MultipleChoice) && props.record.type !== type ? false : undefined),
        });

        if (type === RecordType.MultipleChoice || type === RecordType.ChooseOne) {
            if (patchedRecord.value.choices.length === 0) {
                if (props.record.choices.length > 0) {
                    // Revert to original choices
                    patchRecord.value = patchRecord.value.patch({ choices: props.record.choices as any });
                }
                else {
                    patchRecord.value = patchRecord.value.patch({
                        choices: [
                            RecordChoice.create({ name: TranslatedString.create($t(`4b9cc9ee-d989-4459-a8d5-727ae490380d`)) }),
                            RecordChoice.create({ name: TranslatedString.create($t(`a09b08eb-216c-4f07-b05c-0a26a4c580eb`)) }),
                        ] as any,
                    });
                }
            }
        }
        else {
            // Delete choices
            patchRecord.value = patchRecord.value.patch({ choices: [] as any });
        }
    },
});

const description = computed({
    get: () => patchedRecord.value.description,
    set: (description) => {
        addPatch({ description });
    },
});

const commentsDescription = computed({
    get: () => patchedRecord.value.commentsDescription,
    set: (commentsDescription) => {
        addPatch({ commentsDescription });
    },
});

const externalPermissionLevel = computed({
    get: () => patchedRecord.value.externalPermissionLevel,
    set: (externalPermissionLevel: PermissionLevel) => {
        addPatch({ externalPermissionLevel });
    },
});

const warningInverted = computed({
    get: () => patchedRecord.value.warning?.inverted ?? null,
    set: (inverted: boolean | null) => {
        if (inverted === null) {
            addPatch({
                warning: null,
            });
            return;
        }
        if (warningInverted.value === null) {
            addPatch({
                warning: RecordWarning.create({
                    inverted,
                }),
            });
        }
        else {
            addPatch({
                warning: RecordWarning.patch({
                    inverted,
                }),
            });
        }
    },
});

const warningText = computed({
    get: () => patchedRecord.value.warning?.text ?? null,
    set: (text: TranslatedString | null) => {
        if (text === null) {
            patchRecord.value = patchRecord.value.patch({
                warning: null,
            });
            return;
        }
        if (warningText.value === null) {
            patchRecord.value = patchRecord.value.patch({
                warning: RecordWarning.create({
                    text,
                }),
            });
        }
        else {
            patchRecord.value = patchRecord.value.patch({
                warning: RecordWarning.patch({
                    text,
                }),
            });
        }
    },
});

const warningType = computed({
    get: () => patchedRecord.value.warning?.type ?? null,
    set: (type: RecordWarningType | null) => {
        if (type === null) {
            patchRecord.value = patchRecord.value.patch({
                warning: null,
            });
            return;
        }
        if (warningType.value === null) {
            patchRecord.value = patchRecord.value.patch({
                warning: RecordWarning.create({
                    type,
                }),
            });
        }
        else {
            patchRecord.value = patchRecord.value.patch({
                warning: RecordWarning.patch({
                    type,
                }),
            });
        }
    },

});

const sensitive = computed({
    get: () => patchedRecord.value.sensitive,
    set: (sensitive: boolean) => {
        // Always require encryption for sensitive information
        addPatch({ sensitive });
    },
});

function addChoicesPatch(patch: PatchableArrayAutoEncoder<RecordChoice>) {
    addPatch(RecordSettings.patch({
        choices: patch,
    }));
}

function addChoice() {
    const choice = RecordChoice.create({});

    present(new ComponentWithProperties(EditRecordChoiceView, {
        choice,
        isNew: true,
        parentRecord: patchedRecord.value,
        saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => {
            addChoicesPatch(patch);
        },
    }).setDisplayStyle('popup')).catch(console.error);
}

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }

    if (name.value.length < 2) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t(`396f75d7-e7d9-42d9-a50e-9ace51c92fe6`),
            field: 'name',
        }));
        return;
    }

    if ((type.value === RecordType.ChooseOne || type.value === RecordType.MultipleChoice) && choices.value.length === 0) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_record',
            message: $t('a3101c16-5dc1-4baf-82fd-9f1f900281d0'),
        }));
        return;
    }

    const arrayPatch: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();

    if (props.isNew) {
        arrayPatch.addPut(patchedRecord.value);
    }
    else {
        arrayPatch.addPatch(patchRecord.value);
    }

    props.saveHandler(arrayPatch);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t(`025e44e2-c48d-4af2-95b4-3e60c98724f6`), $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`), $t(`fa50aa94-4f8a-428a-9b97-8b477176240a`))) {
        return;
    }

    if (props.isNew) {
        // do nothing
        pop({ force: true })?.catch(console.error);
        return;
    }

    const arrayPatch: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    arrayPatch.addDelete(props.record.id);

    props.saveHandler(arrayPatch);
    pop({ force: true })?.catch(console.error);
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
};

function openPreview() {
    present(new ComponentWithProperties(PreviewRecordView, {
        record: patchedRecord,
    }).setDisplayStyle('popup')).catch(console.error);
}

defineExpose({
    shouldNavigateAway,
});
</script>
