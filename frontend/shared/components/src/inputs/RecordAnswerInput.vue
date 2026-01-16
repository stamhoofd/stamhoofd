<!-- eslint-disable vue/no-v-html -->
<template>
    <div>
        <Checkbox v-if="answer.settings.type === RecordType.Checkbox" v-model="selected">
            <h3 class="style-title-list">
                {{ label }}
            </h3>
            <p v-if="answer.settings.description.length" class="style-description-small pre-wrap style-wysiwyg" v-html="linkText(answer.settings.description.toString())" />
        </Checkbox>
        <STInputBox v-else-if="answer.settings.type === RecordType.MultipleChoice" class="max" :title="label" error-fields="input" :error-box="errors.errorBox">
            <STList>
                <STListItem v-for="choice in record.choices" :key="choice.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getChoiceSelected(choice)" @update:model-value="setChoiceSelected(choice, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ choice.name }}
                    </h3>
                    <p v-if="choice.description.length" class="style-description-small pre-wrap" v-text="choice.description" />
                </STListItem>
            </STList>
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type === RecordType.ChooseOne" class="max" :title="label" error-fields="input" :error-box="errors.errorBox">
            <STList>
                <STListItem v-for="choice in record.choices" :key="choice.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="selectedChoice" :name="'record-answer-'+answer.id" :value="choice.id" />
                    </template>
                    <h3 class="style-title-list">
                        {{ choice.name }}
                    </h3>
                    <p v-if="choice.description.length" class="style-description-small pre-wrap" v-text="choice.description" />
                </STListItem>
            </STList>
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type === RecordType.Text" :title="label" error-fields="input" :error-box="errors.errorBox">
            <input v-model="textValue" :placeholder="inputPlaceholder.toString()" class="input">
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type === RecordType.Textarea" :title="label" class="max" error-fields="input" :error-box="errors.errorBox">
            <textarea v-model="textValue" :placeholder="inputPlaceholder.toString()" class="input" />
        </STInputBox>
        <AddressInput v-else-if="answer.settings.type === RecordType.Address" v-model="addressValue" :title="label" :required="required" :validator="errors.validator" :nullable="true" />
        <PhoneInput v-else-if="answer.settings.type === RecordType.Phone" v-model="textValue" :placeholder="inputPlaceholder" :title="label" :required="required" :validator="errors.validator" :nullable="true" />
        <EmailInput v-else-if="answer.settings.type === RecordType.Email" v-model="textValue" :placeholder="inputPlaceholder" :title="label" :required="required" :validator="errors.validator" :nullable="true" />
        <STInputBox v-else-if="answer.settings.type === RecordType.Date" :title="label" error-fields="input" :error-box="errors.errorBox">
            <DateSelection v-model="dateValue" :required="required" :validator="validator" :placeholder="inputPlaceholder.toString()" />
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type === RecordType.Price" :title="label" error-fields="input" :error-box="errors.errorBox">
            <PriceInput v-model="priceValue" :required="required" :validator="validator" :placeholder="inputPlaceholder.toString()" />
        </STInputBox>
        <ImageInput v-else-if="answer.settings.type === RecordType.Image" v-model="imageValue" :title="label" :required="required" :validator="errors.validator" :resolutions="record.resolutions" :is-private="true" />
        <FileInput v-else-if="answer.settings.type === RecordType.File" v-model="fileValue" :accept="accept" :title="label" :required="required" :validator="errors.validator" :is-private="true" />
        <STInputBox v-else-if="answer.settings.type === RecordType.Integer" :title="label" error-fields="input" :error-box="errors.errorBox">
            <NumberInput v-model="integerValue" :required="required" :validator="validator" :placeholder="inputPlaceholder.toString()" />
        </STInputBox>

        <p v-else class="error-box">
            {{ $t('670ff020-405b-4e81-88e0-c2afa77a4660') }}
        </p>

        <div v-if="answer.settings.type === RecordType.Checkbox && selected && answer.settings.askComments" class="textarea-container">
            <textarea v-model="comments" class="input small" :placeholder="inputPlaceholder.toString()" />
            <p v-if="answer.settings.commentsDescription.length" class="info-box style-wysiwyg">
                <span class="pre-wrap" v-html="linkText(answer.settings.commentsDescription.toString())" />
            </p>
        </div>

        <p v-if="answer.settings.type !== RecordType.Checkbox && answer.settings.description.length" class="style-description-small pre-wrap style-wysiwyg" v-html="linkText(answer.settings.description.toString())" />
        <STErrorsDefault :error-box="errors.errorBox" />
    </div>
</template>

<script lang="ts" setup>
import { Address, FileType, Image, PatchAnswers, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordCheckboxAnswer, RecordChoice, RecordChooseOneAnswer, RecordDateAnswer, RecordFileAnswer, RecordImageAnswer, RecordIntegerAnswer, RecordMultipleChoiceAnswer, RecordPriceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';

import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { computed, onMounted } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { Validator } from '../errors/Validator';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import AddressInput from './AddressInput.vue';
import Checkbox from './Checkbox.vue';
import DateSelection from './DateSelection.vue';
import EmailInput from './EmailInput.vue';
import FileInput from './FileInput.vue';
import ImageInput from './ImageInput.vue';
import NumberInput from './NumberInput.vue';
import PhoneInput from './PhoneInput.vue';
import PriceInput from './PriceInput.vue';
import Radio from './Radio.vue';
import STInputBox from './STInputBox.vue';
import { useLinkableText } from './hooks/useLinkableText';

const props = withDefaults(defineProps<{
    record: RecordSettings;
    // Used to find the currently saved answer
    answers: Map<string, RecordAnswer>;
    validator: Validator;
    allOptional?: boolean;
    markReviewed?: boolean;
}>(), {
    markReviewed: false,
    allOptional: false,
});
const linkText = useLinkableText();
const emit = defineEmits<{
    patch: [patch: PatchAnswers];
}>();
const errors = useErrors({ validator: props.validator });

const answer = computed({
    get: () => {
        const existing = props.answers.get(props.record.id);
        const type = RecordAnswerDecoder.getClassForType(props.record.type);
        if (existing !== undefined && existing instanceof type) {
            if (existing.settings !== props.record) {
                existing.settings = props.record;
            }
            return existing;
        }

        // Create a new one
        return RecordAnswer.createDefaultAnswer(props.record);
    },

    set: (value: RecordAnswer) => {
        const patch = new PatchMap() as PatchAnswers;

        if (props.markReviewed) {
            value.markReviewed();
        }
        patch.set(props.record.id, value);
        emit('patch', patch);
    },
});

function patchAnswer(patch: AutoEncoderPatchType<RecordAnswer>) {
    const patchMap = new PatchMap() as PatchAnswers;

    // PatchAnswer doesn't support pathces becase it is a generic type (needs type for decoding, which we don't support yet - See RecordAnswerDecoder)
    patchMap.set(props.record.id, answer.value.patch(patch));
    emit('patch', patchMap);
}

const casted = {
    RecordTextAnswer: computed(() => answer.value instanceof RecordTextAnswer ? answer.value : null),
    RecordMultipleChoiceAnswer: computed(() => answer.value instanceof RecordMultipleChoiceAnswer ? answer.value : null),
    RecordCheckboxAnswer: computed(() => answer.value instanceof RecordCheckboxAnswer ? answer.value : null),
    RecordChooseOneAnswer: computed(() => answer.value instanceof RecordChooseOneAnswer ? answer.value : null),
    RecordAddressAnswer: computed(() => answer.value instanceof RecordAddressAnswer ? answer.value : null),
    RecordDateAnswer: computed(() => answer.value instanceof RecordDateAnswer ? answer.value : null),
    RecordPriceAnswer: computed(() => answer.value instanceof RecordPriceAnswer ? answer.value : null),
    RecordImageAnswer: computed(() => answer.value instanceof RecordImageAnswer ? answer.value : null),
    RecordFileAnswer: computed(() => answer.value instanceof RecordFileAnswer ? answer.value : null),
    RecordIntegerAnswer: computed(() => answer.value instanceof RecordIntegerAnswer ? answer.value : null),
};

const label = computed(() => props.record.label.length ? props.record.label : props.record.name);
const required = computed(() => !props.allOptional && props.record.required);
const inputPlaceholder = computed(() => {
    if (!required.value) {
        if (answer.value.settings.inputPlaceholder.length > 0) {
            if (props.record.type === RecordType.Integer) {
                return answer.value.settings.inputPlaceholder;
            }
            return $t(`b2933d54-b2ec-4fde-965c-7d62de768a1e`) + ' ' + answer.value.settings.inputPlaceholder;
        }
        return $t(`6b886749-1039-4c0b-b239-fbae9fd5f291`);
    }
    return answer.value.settings.inputPlaceholder.length ? answer.value.settings.inputPlaceholder : answer.value.settings.name;
});

const selected = computed({
    get: () => {
        return casted.RecordCheckboxAnswer.value?.selected ?? false;
    },
    set: (selected: boolean) => {
        patchAnswer(RecordCheckboxAnswer.patch({
            selected,
        }));
    },
});

const comments = computed({
    get: () => {
        return casted.RecordCheckboxAnswer.value?.comments ?? '';
    },
    set: (comments: string) => {
        patchAnswer(RecordCheckboxAnswer.patch({
            comments,
        }));
    },
});

const selectedChoice = computed({
    get: () => {
        return casted.RecordChooseOneAnswer.value?.selectedChoice?.id ?? null;
    },
    set: (selectedChoiceId: string | null) => {
        const selectedChoice = props.record.choices.find(c => c.id === selectedChoiceId);
        patchAnswer(RecordChooseOneAnswer.patch({
            selectedChoice,
        }));
    },
});

const integerValue = computed({
    get: () => {
        return casted.RecordIntegerAnswer.value?.value ?? null;
    },
    set: (value: number | null) => {
        patchAnswer(RecordIntegerAnswer.patch({
            value,
        }));
    },
});

const priceValue = computed({
    get: () => {
        return casted.RecordPriceAnswer.value?.value ?? null;
    },
    set: (value: number | null) => {
        patchAnswer(RecordPriceAnswer.patch({
            value,
        }));
    },
});

const textValue = computed({
    get: () => {
        return casted.RecordTextAnswer.value?.value ?? '';
    },
    set: (value: string) => {
        patchAnswer(RecordTextAnswer.patch({
            value,
        }));
    },
});

const addressValue = computed({
    get: () => {
        return casted.RecordAddressAnswer.value?.address ?? null;
    },
    set: (address: Address | null) => {
        patchAnswer(RecordAddressAnswer.patch({
            address,
        }));
    },
});

const dateValue = computed({
    get: () => {
        return casted.RecordDateAnswer.value?.dateValue ?? null;
    },
    set: (dateValue: Date | null) => {
        patchAnswer(RecordDateAnswer.patch({
            dateValue,
        }));
    },
});

const imageValue = computed({
    get: () => {
        return casted.RecordImageAnswer.value?.image ?? null;
    },
    set: (image: Image | null) => {
        patchAnswer(RecordImageAnswer.patch({
            image,
        }));
    },
});

const fileValue = computed({
    get: () => {
        return casted.RecordFileAnswer.value?.file ?? null;
    },
    set: (file) => {
        patchAnswer(RecordFileAnswer.patch({
            file,
        }));
    },
});

const accept = computed(() => {
    if (props.record.type === RecordType.File) {
        switch (props.record.fileType) {
            case FileType.PDF:
                return 'application/pdf';
            case FileType.Excel:
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
            case FileType.Word:
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
            default:
                return '';
        }
    }
    return '';
});

function getChoiceSelected(choice: RecordChoice): boolean {
    return !!(casted.RecordMultipleChoiceAnswer.value)?.selectedChoices.find(c => c.id === choice.id);
}

function setChoiceSelected(choice: RecordChoice, selected: boolean) {
    if (selected === getChoiceSelected(choice)) {
        return;
    }
    const v = casted.RecordMultipleChoiceAnswer.value;
    if (!v) {
        return;
    }

    const choices = v.selectedChoices.filter(c => c.id !== choice.id);

    if (selected) {
        patchAnswer(RecordMultipleChoiceAnswer.patch({
            selectedChoices: [...choices, choice] as any,
        }));
    }
    else {
        patchAnswer(RecordMultipleChoiceAnswer.patch({
            selectedChoices: choices as any,
        }));
    }
}

useValidation(props.validator, () => {
    const valid = isValid();

    if (valid) {
        if (props.markReviewed) {
            answer.value = answer.value as any;
        }
    }

    return valid;
});

onMounted(() => {
    // Make sure the answer (updated one) is inside the recordAnswers
    const existing = props.answers.get(props.record.id);
    const readValue = answer.value;
    if ((existing === undefined && !props.allOptional) || existing !== readValue) {
        answer.value = readValue;
    }
});

function isValid() {
    if (props.allOptional && answer.value.isEmpty) {
        return true;
    }

    try {
        answer.value.validate();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        return false;
    }
    errors.errorBox = null;
    return true;
}
</script>
