<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <TInput v-model="name" :placeholder="$t(`%Sk`)" error-fields="name" :error-box="errorBox" :title="$t(`%Gq`)" />
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

<script lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder} from '@simonbackx/simple-encoding';
import { PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import type { ErrorBox } from '#errors/ErrorBox.ts';
import Radio from '#inputs/Radio.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import { Validator } from '#errors/Validator.ts';
import type { RecordSettings, TranslatedString} from '@stamhoofd/structures';
import { RecordChoice, RecordWarning, RecordWarningType, Version } from '@stamhoofd/structures';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Radio,
    },
})
export default class EditRecordChoiceView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();

    @Prop({ required: true })
    choice!: RecordChoice;

    @Prop({ required: false, default: null })
    parentCategory!: RecordSettings | null;

    @Prop({ required: true })
    isNew!: boolean;

    patchChoice: AutoEncoderPatchType<RecordChoice> = RecordChoice.patch({ id: this.choice.id });

    @Prop({ required: true })
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => void;

    get RecordWarningType() {
        return RecordWarningType;
    }

    get patchedChoice() {
        return this.choice.patch(this.patchChoice);
    }

    get title(): string {
        if (this.isNew) {
            return $t(`%10x`);
        }
        return $t(`%10y`);
    }

    get name() {
        return this.patchedChoice.name;
    }

    set name(name: TranslatedString) {
        this.patchChoice = this.patchChoice.patch({ name });
    }

    get description() {
        return this.patchedChoice.description;
    }

    set description(description: TranslatedString) {
        this.patchChoice = this.patchChoice.patch({ description });
    }

    get warningInverted() {
        return this.patchedChoice.warning?.inverted ?? null;
    }

    set warningInverted(inverted: boolean | null) {
        if (inverted === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: null,
            });
            return;
        }
        if (this.warningInverted === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.create({
                    inverted,
                }),
            });
        }
        else {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.patch({
                    inverted,
                }),
            });
        }
    }

    get warningText() {
        return this.patchedChoice.warning?.text ?? null;
    }

    set warningText(text: TranslatedString | null) {
        if (text === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: null,
            });
            return;
        }
        if (this.warningText === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.create({
                    text,
                }),
            });
        }
        else {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.patch({
                    text,
                }),
            });
        }
    }

    get warningType() {
        return this.patchedChoice.warning?.type ?? null;
    }

    set warningType(type: RecordWarningType | null) {
        if (type === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: null,
            });
            return;
        }
        if (this.warningType === null) {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.create({
                    type,
                }),
            });
        }
        else {
            this.patchChoice = this.patchChoice.patch({
                warning: RecordWarning.patch({
                    type,
                }),
            });
        }
    }

    addPatch(patch: AutoEncoderPatchType<RecordChoice>) {
        this.patchChoice = this.patchChoice.patch(patch);
    }

    async save() {
        const isValid = await this.validator.validate();
        if (!isValid) {
            return;
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();

        if (this.isNew) {
            arrayPatch.addPut(this.patchedChoice);
        }
        else {
            arrayPatch.addPatch(this.patchChoice);
        }

        this.saveHandler(arrayPatch);
        this.pop({ force: true });
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm($t(`%10z`), $t(`%CJ`))) {
            return;
        }

        if (this.isNew) {
            // do nothing
            this.pop({ force: true });
            return;
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();
        arrayPatch.addDelete(this.choice.id);

        this.saveHandler(arrayPatch);
        this.pop({ force: true });
    }

    cancel() {
        this.pop();
    }

    get hasChanges() {
        return patchContainsChanges(this.patchChoice, this.choice, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
    }
}
</script>
