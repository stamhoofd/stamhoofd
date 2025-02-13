<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vraag kan instellen.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox title="Naam (kort)" error-fields="name" :error-box="errors.errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="bv. Toestemming publicatie foto’s"
                        autocomplete="off"
                        enterkeyhint="next"
                    >
                </STInputBox>
            </div>

            <div>
                <STInputBox title="Type" error-fields="type" :error-box="errors.errorBox">
                    <Dropdown v-model="type">
                        <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                            <option v-for="_type in group.values" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type === RecordType.File" title="Bestandtype" error-fields="fileType" :error-box="errors.errorBox">
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
            Voeg tekstvak toe indien aangevinkt
        </Checkbox>

        <div v-if="type === RecordType.MultipleChoice || type === RecordType.ChooseOne" class="container">
            <hr>
            <h2 class="style-with-button with-list">
                <div>Keuzeopties</div>
                <div>
                    <button class="button text" type="button" @click="addChoice">
                        <span class="icon add" />
                        <span>Nieuw</span>
                    </button>
                </div>
            </h2>

            <STList v-if="patchedRecord.choices.length > 0" v-model="choices" :draggable="true">
                <template #item="{item: choice}">
                    <RecordChoiceRow :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch" />
                </template>
            </STList>

            <p v-else class="info-box">
                <span>Geen keuzemogelijkheden. Voeg een keuze toe via de <span class="icon add middle" />-knop.</span>
            </p>
        </div>

        <hr>
        <h2 class="style-with-button">
            <div>Beschrijving</div>
            <div>
                <button class="button text" type="button" @click="openPreview">
                    <span class="icon eye" />
                    <span>Voorbeeld</span>
                </button>
            </div>
        </h2>
        <p>Bepaal hoe men deze vraag kan beantwoorden door extra verduidelijking te voorzien.</p>

        <STInputBox :title="labelTitle" error-fields="label" :error-box="errors.errorBox" class="max">
            <input
                v-model="label"
                class="input"
                type="text"
                :placeholder="name"
                autocomplete="off"
                enterkeyhint="next"
            >
        </STInputBox>

        <STInputBox :title="descriptionTitle" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete="off"
            />
        </STInputBox>
        <p class="style-description-small">
            Gebruik deze tekst voor een langere uitleg bij het instellen van dit kenmerk, enkel indien dat echt nodig is.
        </p>

        <STInputBox v-if="shouldAskInputPlaceholder" title="Tekst in leeg tekstvak" error-fields="label" :error-box="errors.errorBox" class="max">
            <input
                v-model="inputPlaceholder"
                class="input"
                type="text"
                placeholder="bv. 'Vul hier jouw naam in'"
                autocomplete="off"
            >
        </STInputBox>
        <p class="style-description-small">
            Het is netter als je een tekst in lege tekstvakken instelt. Je kan van deze plaats gebruik maken om een voorbeeld te geven, om het duidelijker te maken (zoals we zelf doen hierboven).
        </p>

        <STInputBox v-if="shouldAskCommentsDescription" title="Tekst onder tekstvak" error-fields="label" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="commentsDescription"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete="off"
            />
        </STInputBox>
        <p v-if="shouldAskCommentsDescription" class="style-description-small">
            Laat hier eventueel extra instructies achter onder het tekstveld, als het aankruisvakje is aangevinkt.
        </p>

        <template v-if="showExternalPermissionLevel">
            <hr>
            <h2>Zichtbaarheid voor leden</h2>
            <p>Beperk de zichtbaarheid van deze vraag voor leden. De toegangsrechten voor beheerders worden hier onafhankelijk van geregeld via de instellingen van functies en beheerdersrollen.</p>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.None" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        Niet zichtbaar
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Read" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        Enkel lezen
                    </h3>
                </STListItem>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="externalPermissionLevel" :value="PermissionLevel.Write" name="righstForNonAdmins" />
                    </template>
                    <h3 class="style-title-list">
                        Bewerken
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="canAddWarning">
            <hr>
            <h2>Waarschuwing</h2>
            <p>Soms wil je dat iets opvalt voor beheerders, dat kan je bereiken met waarschuwingen. Die zijn zichtbaar voor beheerders als dit kenmerk een bepaalde waarde heeft.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="null" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        Geen waarschuwing
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

            <STInputBox v-if="warningText !== null" title="Waarschuwingstekst" error-fields="label" :error-box="errors.errorBox" class="max">
                <input
                    v-model="warningText"
                    class="input"
                    type="text"
                    placeholder="bv. 'Geen toestemming om foto's te maken'"
                    autocomplete="off"
                >
            </STInputBox>

            <STInputBox v-if="warningType" class="max" title="Type">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Info" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Informatief
                        </h3>
                        <p class="style-description-small">
                            Grijze achtergrond. Voor minder belangrijke zaken
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Warning" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Waarschuwing
                        </h3>
                        <p class="style-description-small">
                            Gele achtergrond
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Error" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Foutmelding
                        </h3>
                        <p class="style-description-small">
                            Voor zaken die echt heel belangrijk zijn. Probeer dit weinig te gebruiken, zet niet alles op 'foutmelding', anders valt het niet meer op.
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <template v-if="settings.dataPermission">
            <hr>
            <h2>Toestemming gegevensverzameling</h2>
            <p>
                Verzamel je gevoelige informatie? Dan moet je daar in de meeste gevallen toestemming voor vragen volgens de GDPR-wetgeving. We raden je aan om altijd toestemming te vragen zodra je ook maar een beetje twijfelt. In onze gids geven we enkele voorbeelden, lees die zeker na. <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                    Lees onze gids
                </a>
            </p>

            <Checkbox v-model="sensitive">
                Ik heb toestemming nodig om deze informatie te verzamelen, of de antwoorden zijn (of bevatten mogelijks) gevoelige informatie
            </Checkbox>
        </template>

        <div v-if="hasFilters" class="container">
            <hr>
            <h2>Slim in- en uitschakelen</h2>

            <PropertyFilterInput v-model="filter" :allow-optional="false" :builder="filterBuilder" />
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
    return filterBuilder.value instanceof GroupUIFilterBuilder && filterBuilder.value.builders.length >= 1;
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
