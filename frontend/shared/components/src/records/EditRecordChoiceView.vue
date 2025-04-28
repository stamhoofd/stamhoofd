<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <TInput v-model="name" :placeholder="$t(`1539d481-12bf-4814-9fe3-3770eaecdda8`)" error-fields="name" :error-box="errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)" />
        <TTextarea v-model="description" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" error-fields="description" :error-box="errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)" />

        <hr><h2>{{ $t('509ab71d-f9e0-4f2a-8683-590b6363b32d') }}</h2>
        <p>{{ $t('8cc76242-2d6a-4354-b199-c6086e8ea03d') }}</p>

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
                    {{ $t('dba56cdb-1bbc-409f-8b9d-550f87505db3') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="warningInverted" :value="true" name="warningInverted" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('1e3c4174-138d-460c-82aa-521fb4edcd49') }}
                </h3>
            </STListItem>
        </STList>

        <TInput v-if="warningText !== null" v-model="warningText" :placeholder="$t(`fd5e3142-7a0e-4305-8a49-35f2f4d89083`)" error-fields="label" :error-box="errorBox" class="max" :title="$t(`73dbf494-16a3-4e9a-8cbe-5170334209c0`)" />
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
            <div v-if="!isNew" class="container">
                <hr><h2>
                    {{ $t('a7a62bda-0ff0-4e86-b417-14eb65ad378c') }}
                </h2>

                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                </button>
            </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, ErrorBox, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from '@stamhoofd/components';
import { RecordChoice, RecordSettings, RecordWarning, RecordWarningType, TranslatedString, Version } from '@stamhoofd/structures';

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
            return $t(`1fc71f7e-0985-4ea7-afc7-aeb29b5d2d8d`);
        }
        return $t(`d35c5964-e8e9-4a42-bdd0-555ab32eda7c`);
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
        if (!await CenteredMessage.confirm($t(`e817f9c6-5714-44b9-93f0-bf698a4d2723`), $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`))) {
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
        return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
    }
}
</script>
