<template>
    <div v-if="!category.isEnabled(value)" class="container">
        <p v-if="STAMHOOFD.environment === 'development'" class="error-box">
            This category should be invisible. Check if the record categories are filtered using .filter(c => c.isEnabled(value))
        </p>
    </div>
    <div v-else class="container">
        <component :is="level === 1 ? 'h1' : 'h2'" class="style-with-button">
            <div>
                {{ category.name }}
                <span v-if="titleSuffix" class="title-suffix">
                    {{ titleSuffix }}
                </span>
            </div>
            <div>
                <button v-if="!markReviewed && hasAnswers" v-tooltip="'Wis alle antwoorden'" type="button" class="button icon trash" @click="clearAnswers" />
            </div>
        </component>

        <p v-if="category.description" class="style-description-block pre-wrap" v-text="category.description" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <slot />

        <RecordAnswerInput v-for="record of filteredWriteableRecords" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        <div v-for="childCategory of childCategories" :key="childCategory.id" class="container">
            <hr>
            <h2>{{ level === 1 ? childCategory.name : (category.name + ': ' + childCategory.name) }}</h2>
            <p v-if="childCategory.description" class="style-description pre-wrap" v-text="childCategory.description" />

            <RecordAnswerInput v-for="record of childCategory.filterRecords(props.value, filterOptions)" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        </div>

        <p v-if="!markReviewed && lastReviewed" class="style-description-small">
            Laatst nagekeken op {{ formatDate(lastReviewed) }}<template v-if="isLastReviewIncomplete">
                (onvolledig)
            </template>. <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                Markeer als nagekeken
            </button>
        </p>
        <p v-if="!markReviewed && !lastReviewed" class="style-description-small">
            Nog nooit nagekeken. <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                Markeer als nagekeken
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchMap } from '@simonbackx/simple-encoding';
import { ObjectWithRecords, PatchAnswers, PermissionLevel, RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context/appContext';
import { Validator } from '../../errors/Validator';
import { useErrors } from '../../errors/useErrors';
import { useValidation } from '../../errors/useValidation';
import RecordAnswerInput from '../../inputs/RecordAnswerInput.vue';
import { ErrorBox } from '../../errors/ErrorBox';
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
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je alle antwoorden wilt wissen?'), $t('Ja, wissen'))) {
        return;
    }
    const patch = new PatchMap() as PatchAnswers;

    for (const record of deepFilteredWriteableRecords.value) {
        patch.set(record.id, null);
    }

    addPatch(patch);
}
</script>
