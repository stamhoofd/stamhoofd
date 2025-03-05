<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            {{ $t('1ee2ff5c-bcc6-4af9-b47f-0ca10a4023c9') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('b93acd89-a91e-4216-b1dd-a8808a50aa78') }}</a> {{ $t('1a751fba-46ff-4d4f-9981-8de1cd52ee6f') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`13820aaf-6866-4c8b-a6bd-01abfe0f0d61`)">
                    <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`ffd27c3e-f13b-4f95-8418-f6091d42fd15`)"></STInputBox>
            </div>

            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`b610d465-2901-4b54-97ae-dbeab72e4762`)">
                    <Dropdown v-model="type">
                        <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                            <option v-for="_type in group.values" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type === RecordType.File" error-fields="fileType" :error-box="errors.errorBox" :title="$t(`c5a5f17a-f8ec-4c07-a3ad-c2419916e7f1`)">
                    <Dropdown v-model="fileType">
                        <option v-for="item in availableFileTypes" :key="item.value" :value="item.value">
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
            {{ $t('4d95fd3c-9141-4526-aefc-b93ad977326f') }}
        </Checkbox>

        <div v-if="type === RecordType.MultipleChoice || type === RecordType.ChooseOne" class="container">
            <hr><h2 class="style-with-button with-list">
                <div>{{ $t('d9257ff7-1c2a-4f4e-bcb7-1b919d911978') }}</div>
                <div>
                    <button class="button text" type="button" @click="addChoice">
                        <span class="icon add"/>
                        <span>{{ $t('a5ee3e2a-e3ee-4290-af56-85a7003d9fc8') }}</span>
                    </button>
                </div>
            </h2>

            <STList v-if="patchedRecord.choices.length > 0" v-model="choices" :draggable="true">
                <template #item="{item: choice}">
                    <RecordChoiceRow :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch"/>
                </template>
            </STList>

            <p v-else class="info-box">
                <span>{{ $t('de17c06e-e495-4885-b8ac-8937cd02adfa') }} <span class="icon add middle"/>{{ $t('cb0103b1-420a-4ab1-b03e-dabc08e30b65') }}</span>
            </p>
        </div>

        <hr><h2 class="style-with-button">
            <div>{{ $t('f72f5546-ed6c-4c93-9b0d-9718f0cc9626') }}</div>
            <div>
                <button class="button text" type="button" @click="openPreview">
                    <span class="icon eye"/>
                    <span>{{ $t('331a41fa-9f3c-4e9b-84fe-ee7f65d92583') }}</span>
                </button>
            </div>
        </h2>
        <p>{{ $t('db1b727c-185c-4c8a-871f-55bc21f85fdb') }}</p>

        <STInputBox :title="labelTitle" error-fields="label" :error-box="errors.errorBox" class="max">
            <input v-model="label" class="input" type="text" :placeholder="name" autocomplete="off" enterkeyhint="next"></STInputBox>

        <STInputBox :title="descriptionTitle" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('8b88fb37-2bfd-486a-9ebb-44ac82b32a71') }}
        </p>

        <STInputBox v-if="shouldAskInputPlaceholder" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`a42fcac5-6fe8-4797-a5c2-07a86df915ab`)">
            <input v-model="inputPlaceholder" class="input" type="text" autocomplete="off" :placeholder="$t(`0985c42f-9798-4d3b-ae62-c67cc5b45c3a`)"></STInputBox>
        <p class="style-description-small">
            {{ $t('9de789fe-e458-4291-9db6-dd529e15eb22') }}
        </p>

        <STInputBox v-if="shouldAskCommentsDescription" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`df605b65-bcf6-406c-b014-cdc6bfab04bc`)">
            <textarea v-model="commentsDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>
        <p v-if="shouldAskCommentsDescription" class="style-description-small">
            {{ $t('812eb1a6-2cb0-4f9e-b92b-46695ce8365e') }}
        </p>

        <template v-if="showExternalPermissionLevel">
            <hr><h2>{{ $t('15acffc6-b289-4019-83f9-439a789d3564') }}</h2>
            <p>{{ $t('ebe5dbb2-4e8a-41ad-8fac-9d45b3c2ac21') }}</p>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.None" name="righstForNonAdmins"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('70d7afba-a0ab-4917-bdf3-d123b7a542ca') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Read" name="righstForNonAdmins"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('5578fbae-bf43-49c3-9133-8443571b9a73') }}
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Write" name="righstForNonAdmins"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('f5783f4e-6515-4988-9622-3d0b0f4290f4') }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="canAddWarning">
            <hr><h2>{{ $t('0c94358f-26c4-434d-85a8-af7b49f3dcba') }}</h2>
            <p>{{ $t('48e707f2-2467-4bcd-ad2f-dd588fa97232') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="null" name="warningInverted"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('a1377c7d-d46e-48be-a102-3776f987eff1') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="false" name="warningInverted"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ warningNonInvertedText }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="true" name="warningInverted"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ warningInvertedText }}
                    </h3>
                </STListItem>
            </STList>

            <STInputBox v-if="warningText !== null" error-fields="label" :error-box="errors.errorBox" class="max" :title="$t(`ec2d213d-35b7-4938-bd72-a05f8a4569b0`)">
                <input v-model="warningText" class="input" type="text" autocomplete="off" :placeholder="$t(`2eaefa45-449f-41d2-a8ef-5c9d765ceb83`)"></STInputBox>

            <STInputBox v-if="warningType" class="max" :title="$t(`b610d465-2901-4b54-97ae-dbeab72e4762`)">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Info" name="warningType"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('00d36793-b202-45ff-9278-9ee6068de932') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('a08311c4-24b8-4481-a98d-0c8bf41f6c6c') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Warning" name="warningType"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('0c94358f-26c4-434d-85a8-af7b49f3dcba') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('58032b6e-ced3-4f52-a0fb-b169d753a1f6') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Error" name="warningType"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('150c5466-955c-4f5e-9147-5364f48b1cbc') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t("d6f14d2d-75fc-4a3f-bc1b-8b9495c4473a") }}
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <template v-if="settings.dataPermission">
            <hr><h2>{{ $t('584a8a6a-a446-4d6c-be89-41ee5713f4cd') }}</h2>
            <p>
                {{ $t('8580237d-e30f-4ae7-9f7d-efeb6d224624') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                    {{ $t('d7a53a98-eb19-4907-bfef-ffaf672524bf') }}
                </a>
            </p>

            <Checkbox v-model="sensitive">
                {{ $t('47ff417f-f489-4164-b7d9-b9c7da7c536f') }}
            </Checkbox>
        </template>

        <div v-if="hasFilters" class="container">
            <hr><h2>{{ $t('41e5ea73-e54f-4ede-8bd7-c012ef3407af') }}</h2>

            <PropertyFilterInput v-model="filter" :allow-optional="false" :builder="filterBuilder"/>
        </div>
    </SaveView>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, GroupUIFilterBuilder, PropertyFilterInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { FileType, ObjectWithRecords, PermissionLevel, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType } from '@stamhoofd/structures';

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
        name: 'Tekst',
        values: [
            {
                value: RecordType.Text,
                name: 'Tekstveld (één lijn)',
            },
            {
                value: RecordType.Textarea,
                name: 'Tekstveld (meerdere lijnen)',
            },
            {
                value: RecordType.Address,
                name: 'Adres',
            },
            {
                value: RecordType.Email,
                name: 'E-mailadres',
            },
            {
                value: RecordType.Phone,
                name: 'Telefoonnummer',
            },
            {
                value: RecordType.Date,
                name: 'Datum',
            },
            {
                value: RecordType.Integer,
                name: 'Getal',
            },
            {
                value: RecordType.Price,
                name: 'Prijs',
            },
        ],
    },
    {
        name: 'Aankruisen',
        values: [
            {
                value: RecordType.Checkbox,
                name: 'Aankruisvakje',
            },
            {
                value: RecordType.ChooseOne,
                name: 'Keuzemenu (kies één)',
            },
            {
                value: RecordType.MultipleChoice,
                name: 'Keuzemenu (kies meerdere)',
            },
        ],
    },
    {
        name: 'Geavanceerd',
        values: [
            {
                value: RecordType.Image,
                name: 'Afbeelding of foto',
            },
            {
                value: RecordType.File,
                name: 'Bestand',
            },
        ],
    },
];

const availableFileTypes = [
    {
        name: 'Alles',
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
        return 'Waarschuwing als aangevinkt';
    }
    return 'Waarschuwing als ingevuld';
});

const warningInvertedText = computed(() => {
    if (patchedRecord.value.type === RecordType.Checkbox) {
        return 'Waarschuwing als niet aangevinkt';
    }
    return 'Waarschuwing als niet ingevuld';
});

const title = computed(() => {
    if (props.isNew) {
        return 'Nieuwe vraag';
    }
    return 'Vraag bewerken';
});

const labelTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return 'Tekst naast aankruisvakje';
    }
    if (type.value === RecordType.MultipleChoice) {
        return 'Titel boven keuzemenu';
    }
    if (type.value === RecordType.ChooseOne) {
        return 'Titel boven keuzemenu';
    }
    return 'Titel boven tekstvak';
});

const descriptionTitle = computed(() => {
    if (type.value === RecordType.Checkbox) {
        return 'Beschrijving naast aankruisvakje';
    }
    if (type.value === RecordType.MultipleChoice) {
        return 'Beschrijving onder keuzemenu';
    }
    if (type.value === RecordType.ChooseOne) {
        return 'Beschrijving onder keuzemenu';
    }
    return 'Beschrijving onder tekstvak';
});

const name = computed({
    get: () => patchedRecord.value.name,
    set: (name: string) => {
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
    set: (label: string) => {
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
    set: (inputPlaceholder: string) => {
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
        return 'Verplicht aankruisen';
    }
    if (type.value === RecordType.MultipleChoice) {
        return 'Verplicht om minstens één keuze te selecteren';
    }
    if (type.value === RecordType.ChooseOne) {
        return 'Verplicht om een keuze te selecteren';
    }
    return 'Verplicht in te vullen';
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
                            RecordChoice.create({ name: 'Keuze 1' }),
                            RecordChoice.create({ name: 'Keuze 2' }),
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
    set: (description: string) => {
        addPatch({ description });
    },
});

const commentsDescription = computed({
    get: () => patchedRecord.value.commentsDescription,
    set: (commentsDescription: string) => {
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
    set: (text: string | null) => {
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
            message: 'Vul een naam in',
            field: 'name',
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
    if (!await CenteredMessage.confirm('Ben je zeker dat je dit kenmerk wilt verwijderen?', 'Verwijderen', 'Alle hieraan verbonden informatie gaat dan ook mogelijks verloren.')) {
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
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
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
