<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            {{ $t('%Hv') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%ia') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <TInput v-model="name" error-fields="name" :placeholder="$t(`%ip`)" :error-box="errors.errorBox" :title="$t(`%Qo`)" />
            </div>

            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`%1B`)">
                    <Dropdown v-model="type">
                        <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                            <option v-for="_type in group.values" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type === RecordType.File" error-fields="fileType" :error-box="errors.errorBox" :title="$t(`%iq`)">
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
            {{ $t('%ib') }}
        </Checkbox>

        <div v-if="type === RecordType.MultipleChoice || type === RecordType.ChooseOne" class="container">
            <hr><h2 class="style-with-button with-list">
                <div>{{ $t('%ic') }}</div>
                <div>
                    <button class="button text" type="button" @click="addChoice">
                        <span class="icon add" />
                        <span>{{ $t('%1IY') }}</span>
                    </button>
                </div>
            </h2>

            <STList v-if="patchedRecord.choices.length > 0" v-model="choices" :draggable="true">
                <template #item="{item: choice}">
                    <RecordChoiceRow :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch" />
                </template>
            </STList>

            <p v-else class="info-box">
                <span>{{ $t('%id') }} <span class="icon add middle" />{{ $t('%ie') }}</span>
            </p>
        </div>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%6o') }}</div>
            <div>
                <button class="button text" type="button" @click="openPreview">
                    <span class="icon eye" />
                    <span>{{ $t('%ID') }}</span>
                </button>
            </div>
        </h2>
        <p>{{ $t('%if') }}</p>

        <TInput v-model="label" :title="labelTitle" error-fields="label" :error-box="errors.errorBox" class="max" :placeholder="name" />

        <TTextarea v-model="description" :title="descriptionTitle" :placeholder="$t(`%14p`)" error-fields="description" :error-box="errors.errorBox" class="max" />
        <p class="style-description-small">
            {{ $t('%ig') }}
        </p>

        <TTextarea v-if="shouldAskInputPlaceholder" v-model="inputPlaceholder" :placeholder="$t(`%is`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`%ir`)" />
        <p class="style-description-small">
            {{ $t('%ih') }}
        </p>

        <TTextarea v-if="shouldAskCommentsDescription" v-model="commentsDescription" :placeholder="$t(`%14p`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`%it`)" />
        <p v-if="shouldAskCommentsDescription" class="style-description-small">
            {{ $t('%ii') }}
        </p>

        <template v-if="showExternalPermissionLevel">
            <hr><h2>{{ $t('%ij') }}</h2>
            <p>{{ $t('%ik') }}</p>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.None" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%il') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Read" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%im') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Write" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%f9') }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="canAddWarning">
            <hr><h2>{{ $t('%zJ') }}</h2>
            <p>{{ $t('%in') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="null" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%iQ') }}
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

            <TTextarea v-if="warningText !== null" v-model="warningText" :placeholder="$t(`%iZ`)" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`%JE`)" />
            <STInputBox v-if="warningType" class="max" :title="$t(`%1B`)">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Info" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%iT') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%iU') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Warning" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%zJ') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%iV') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Error" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%iW') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t("%iY") }}
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <template v-if="settings.dataPermission">
            <hr><h2>{{ $t('%vY') }}</h2>
            <p>
                {{ $t('%i1') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                    {{ $t('%i2') }}
                </a>
            </p>

            <Checkbox v-model="sensitive">
                {{ $t('%io') }}
            </Checkbox>
        </template>

        <div v-if="hasFilters" class="container">
            <hr><h2>{{ $t('%iK') }}</h2>

            <PropertyFilterInput v-model="filter" :allow-optional="false" :builder="filterBuilder" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import Checkbox from '#inputs/Checkbox.vue';
import Dropdown from '#inputs/Dropdown.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { GroupUIFilterBuilder } from '#filters/GroupUIFilter.ts';
import PropertyFilterInput from '#filters/PropertyFilterInput.vue';
import Radio from '#inputs/Radio.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
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
        name: $t(`%110`),
        values: [
            {
                value: RecordType.Text,
                name: $t(`%111`),
            },
            {
                value: RecordType.Textarea,
                name: $t(`%112`),
            },
            {
                value: RecordType.Address,
                name: $t(`%Cn`),
            },
            {
                value: RecordType.Email,
                name: $t(`%1FK`),
            },
            {
                value: RecordType.Phone,
                name: $t(`%wD`),
            },
            {
                value: RecordType.Date,
                name: $t(`%7R`),
            },
            {
                value: RecordType.Integer,
                name: $t(`%113`),
            },
            {
                value: RecordType.Price,
                name: $t(`%1IP`),
            },
        ],
    },
    {
        name: $t(`%114`),
        values: [
            {
                value: RecordType.Checkbox,
                name: $t(`%115`),
            },
            {
                value: RecordType.ChooseOne,
                name: $t(`%116`),
            },
            {
                value: RecordType.MultipleChoice,
                name: $t(`%117`),
            },
        ],
    },
    {
        name: $t(`%HQ`),
        values: [
            {
                value: RecordType.Image,
                name: $t(`%118`),
            },
            {
                value: RecordType.File,
                name: $t(`%yU`),
            },
        ],
    },
];

const availableFileTypes = [
    {
        name: $t(`%c9`),
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
        return $t(`%iR`);
    }
    return $t(`%119`);
});

const warningInvertedText = computed(() => {
    if (patchedRecord.value.type === RecordType.Checkbox) {
        return $t(`%iS`);
    }
    return $t(`%11A`);
});

const title = computed(() => {
    if (props.isNew) {
        return $t(`%11B`);
    }
    return $t(`%Sf`);
});

const labelTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return $t(`%iB`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`%11C`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`%11C`);
    }
    return $t(`%11D`);
});

const descriptionTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return $t(`%11E`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`%11F`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`%11F`);
    }
    return $t(`%11G`);
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
        return $t(`%11H`);
    }
    if (type.value === RecordType.MultipleChoice) {
        return $t(`%11I`);
    }
    if (type.value === RecordType.ChooseOne) {
        return $t(`%11J`);
    }
    return $t(`%yw`);
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
                            RecordChoice.create({ name: TranslatedString.create($t(`%11K`)) }),
                            RecordChoice.create({ name: TranslatedString.create($t(`%11L`)) }),
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
            message: $t(`%11M`),
            field: 'name',
        }));
        return;
    }

    if ((type.value === RecordType.ChooseOne || type.value === RecordType.MultipleChoice) && choices.value.length === 0) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_record',
            message: $t('%CU'),
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
    if (!await CenteredMessage.confirm($t(`%11N`), $t(`%CJ`), $t(`%11O`))) {
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
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
