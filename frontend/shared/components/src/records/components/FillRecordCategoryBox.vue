<template>
    <div v-if="!category.isEnabled(value as ObjectWithRecords)" class="container">
        <p v-if="STAMHOOFD.environment === 'development'" class="error-box">
            {{ $t('02b0533d-31b1-44ce-a22b-47d7f90adea8') }}
        </p>
    </div>
    <div v-else class="container">
        <h1 v-if="level === 1">
            {{ category.name }}
            <span v-if="titleSuffix" class="title-suffix">
                {{ titleSuffix }}
            </span>
        </h1>
        <h2 v-else class="style-with-button">
            <div>
                {{ category.name }}
                <span v-if="titleSuffix" class="title-suffix">
                    {{ titleSuffix }}
                </span>
            </div>
            <div>
                <button v-if="!markReviewed && hasAnswers" type="button" class="button icon trash" :v-tooltip="$t('dd1f78c5-9a9e-4535-8527-3f50619860c7')" @click="clearAnswers" />
            </div>
        </h2>

        <p v-if="category.description" class="style-description-block pre-wrap" v-text="category.description" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <slot />

        <RecordAnswerInput v-for="record of filteredWriteableRecords" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        <div v-for="childCategory of childCategories" :key="childCategory.id" class="container">
            <hr><h2>{{ level === 1 ? childCategory.name : (category.name + ': ' + childCategory.name) }}</h2>
            <p v-if="childCategory.description" class="style-description pre-wrap" v-text="childCategory.description" />

            <RecordAnswerInput v-for="record of childCategory.filterRecords(props.value, filterOptions)" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        </div>

        <p v-if="!markReviewed && lastReviewed" class="style-description-small">
            {{ $t('46f4bb39-74c1-43fc-9000-ec7ef9574f03', {date: formatDate(lastReviewed)}) }}<template v-if="isLastReviewIncomplete">
                {{ $t('5811ac7a-ecb4-4ef4-8cbd-1a7c437c9c2e') }}
            </template>. <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                {{ $t('168f25d2-74c1-4c18-818a-796e7a8fee41') }}
            </button>
        </p>
        <p v-if="!markReviewed && !lastReviewed" class="style-description-small">
            {{ $t('252a9a8f-4310-4ee6-98de-d6405ca544f1') }} <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                {{ $t('168f25d2-74c1-4c18-818a-796e7a8fee41') }}
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchMap } from '@simonbackx/simple-encoding';
import { ObjectWithRecords, PatchAnswers, PermissionLevel, RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context/appContext';
import { ErrorBox } from '../../errors/ErrorBox';
import { Validator } from '../../errors/Validator';
import { useErrors } from '../../errors/useErrors';
import { useValidation } from '../../errors/useValidation';
import RecordAnswerInput from '../../inputs/RecordAnswerInput.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        category: RecordCategory;
        /**
         * Patched Value
         */
        value: T;
        validator: Validator;
        parentErrorBox?: ErrorBox | null;
        level?: number;
        allOptional?: boolean;
        titleSuffix?: string;
        forceMarkReviewed?: boolean | null;
    }>(), {
        level: 1,
        allOptional: false,
        titleSuffix: '',
        forceMarkReviewed: null,
        parentErrorBox: null,
    },
);
const errors = useErrors({ validator: props.validator });
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const markReviewed = props.forceMarkReviewed ?? (app !== 'dashboard' && app !== 'admin');
const filterOptions = isAdmin
    ? undefined
    : {
            level: PermissionLevel.Write,
        };

useValidation(props.validator, () => {
    if (markReviewed) {
        doMarkReviewed();
    }
    return true;
});

const emit = defineEmits<{
    patch: [patch: PatchAnswers];
}>();

const addPatch = (patch: PatchAnswers) => {
    emit('patch', patch);
};

const answers = computed(() => {
    return props.value.getRecordAnswers();
});
const lastReviewed = computed(() => calculateLastReviewed());
const isLastReviewIncomplete = computed(() => calculateLastReviewIncomplete(lastReviewed.value));
const now = new Date();

const canMarkReviewed = computed(() => !lastReviewed.value || lastReviewed.value < now || isLastReviewIncomplete.value);

const filteredWriteableRecords = computed(() => {
    return props.category.filterRecords(props.value, filterOptions);
});

const deepFilteredWriteableRecords = computed(() => {
    return props.category.getAllFilteredRecords(props.value, filterOptions);
});

const isOptional = computed(() => {
    return props.allOptional || (!!props.category.filter && (props.category.filter.requiredWhen === null || !props.value.doesMatchFilter(props.category.filter.requiredWhen)));
});

const childCategories = computed(() => {
    return props.category.filterChildCategories(props.value);
});

function calculateLastReviewed() {
    let last: Date | null = null;

    for (const record of deepFilteredWriteableRecords.value) {
        const answer = answers.value.get(record.id);
        if (answer && answer.reviewedAt) {
            // Mark reviewed
            if (!last || answer.reviewedAt < last) {
                last = answer.reviewedAt;
            }
        }
    }
    return last;
}

function calculateLastReviewIncomplete(date: Date | null) {
    if (date === null) {
        return false;
    }

    for (const record of deepFilteredWriteableRecords.value) {
        const answer = answers.value.get(record.id);
        if (!answer || !answer.reviewedAt || answer.reviewedAt < date) {
            return true;
        }
    }
    return false;
}

function doMarkReviewed() {
    const patch = new PatchMap() as PatchAnswers;

    for (const record of deepFilteredWriteableRecords.value) {
        const answer = answers.value.get(record.id);
        if (!answer) {
            continue;
        }
        patch.set(record.id, answer.patch({
            reviewedAt: new Date(),
        }));
    }

    addPatch(patch);
}

const hasAnswers = computed(() => {
    for (const record of deepFilteredWriteableRecords.value) {
        const a = answers.value.get(record.id);
        if (a && !a.isEmpty) {
            return true;
        }
    }
    return false;
});

async function clearAnswers() {
    if (!await CenteredMessage.confirm($t('e977e290-dff3-401c-a520-0a5e8abac1e1'), $t('587c7b87-b79e-4f3c-a55e-9fc8331d86c6'))) {
        return;
    }
    const patch = new PatchMap() as PatchAnswers;

    for (const record of deepFilteredWriteableRecords.value) {
        patch.set(record.id, null);
    }

    addPatch(patch);
}
</script>
