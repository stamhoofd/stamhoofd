<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <TInput v-model="name" :placeholder="$t(`%Sk`)" error-fields="name" :error-box="errorBox" :title="$t(`%1Os`)" />
        <TTextarea v-model="description" :placeholder="$t(`%14p`)" error-fields="description" :error-box="errorBox" class="max" :title="$t(`%6o`)" />

        <hr><h2>{{ $t('%zJ') }}</h2>
        <p>{{ $t('%iP') }}</p>

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
                    {{ $t('%iR') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="warningInverted" :value="true" name="warningInverted" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%iS') }}
                </h3>
            </STListItem>
        </STList>

        <TInput v-if="warningText !== null" v-model="warningText" :placeholder="$t(`%iZ`)" error-fields="label" :error-box="errorBox" class="max" :title="$t(`%JE`)" />
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
        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%iX') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import type { ErrorBox } from '#errors/ErrorBox.ts';
import Radio from '#inputs/Radio.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import { Validator } from '#errors/Validator.ts';
import type { RecordSettings, TranslatedString } from '@stamhoofd/structures';
import { RecordChoice, RecordWarning, RecordWarningType, Version } from '@stamhoofd/structures';
import { computed, ref, shallowRef } from 'vue';

const props = withDefaults(defineProps<{
    choice: RecordChoice;
    parentCategory?: RecordSettings | null;
    isNew: boolean;
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => void;
}>(), {
    parentCategory: null,
});
const pop = usePop();
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const patchChoice = shallowRef<AutoEncoderPatchType<RecordChoice>>(RecordChoice.patch({ id: props.choice.id }));
const patchedChoice = computed(() => props.choice.patch(patchChoice.value));
const title = computed(() => props.isNew ? $t(`%10x`) : $t(`%10y`));
const name = computed({
    get: () => patchedChoice.value.name,
    set: (name: TranslatedString) => patchChoice.value = patchChoice.value.patch({ name }),
});
const description = computed({
    get: () => patchedChoice.value.description,
    set: (description: TranslatedString) => patchChoice.value = patchChoice.value.patch({ description }),
});

const warningInverted = computed({
    get: () => patchedChoice.value.warning?.inverted ?? null,
    set: (inverted: boolean | null) => {
        if (inverted === null) {
            patchChoice.value = patchChoice.value.patch({ warning: null });
            return;
        }
        patchChoice.value = patchChoice.value.patch({
            warning: warningInverted.value === null
                ? RecordWarning.create({ inverted })
                : RecordWarning.patch({ inverted }),
        });
    },
});

const warningText = computed({
    get: () => patchedChoice.value.warning?.text ?? null,
    set: (text: TranslatedString | null) => {
        if (text === null) {
            patchChoice.value = patchChoice.value.patch({ warning: null });
            return;
        }
        patchChoice.value = patchChoice.value.patch({
            warning: warningText.value === null
                ? RecordWarning.create({ text })
                : RecordWarning.patch({ text }),
        });
    },
});

const warningType = computed({
    get: () => patchedChoice.value.warning?.type ?? null,
    set: (type: RecordWarningType | null) => {
        if (type === null) {
            patchChoice.value = patchChoice.value.patch({ warning: null });
            return;
        }
        patchChoice.value = patchChoice.value.patch({
            warning: warningType.value === null
                ? RecordWarning.create({ type })
                : RecordWarning.patch({ type }),
        });
    },
});

const hasChanges = computed(() => patchContainsChanges(patchChoice.value, props.choice, { version: Version }));

async function save() {
    if (!await validator.validate()) {
        return;
    }

    const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();
    if (props.isNew) {
        arrayPatch.addPut(patchedChoice.value);
    } else {
        arrayPatch.addPatch(patchChoice.value);
    }
    props.saveHandler(arrayPatch);
    await pop({ force: true });
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t(`%10z`), $t(`%CJ`))) {
        return;
    }

    if (props.isNew) {
        await pop({ force: true });
        return;
    }

    const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();
    arrayPatch.addDelete(props.choice.id);
    props.saveHandler(arrayPatch);
    await pop({ force: true });
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
}

defineExpose({ shouldNavigateAway });
</script>
