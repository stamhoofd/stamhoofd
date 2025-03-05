<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox"/>

        <STInputBox error-fields="name" :error-box="errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`a9d8f27c-b4d3-415a-94a4-2ec3c018ee48`)"></STInputBox>
    
        <STInputBox error-fields="description" :error-box="errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>

        <hr><h2>{{ $t('0c94358f-26c4-434d-85a8-af7b49f3dcba') }}</h2>
        <p>{{ $t('f3be5d04-ce33-40be-b6d7-82c576df9155') }}</p>

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
                    {{ $t('1584cde5-f783-4e5c-adbc-71b63d1fa6a1') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="warningInverted" :value="true" name="warningInverted"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('bcf85ddc-d71f-49c6-b9d1-f3de0159eaed') }}
                </h3>
            </STListItem>
        </STList>

        <STInputBox v-if="warningText !== null" error-fields="label" :error-box="errorBox" class="max" :title="$t(`ec2d213d-35b7-4938-bd72-a05f8a4569b0`)">
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
        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('80976efa-3f08-47c4-a64e-b460f4862f56') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { RecordChoice, RecordSettings, RecordWarning, RecordWarningType, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Radio
    },
})
export default class EditRecordChoiceView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    choice!: RecordChoice

    @Prop({ required: false, default: null })
    parentCategory!: RecordSettings | null

    @Prop({ required: true })
    isNew!: boolean

    patchChoice: AutoEncoderPatchType<RecordChoice> = RecordChoice.patch({ id: this.choice.id })

    @Prop({ required: true })
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => void;

    get RecordWarningType() {
        return RecordWarningType
    }

    get patchedChoice() {
        return this.choice.patch(this.patchChoice)
    }

    get title(): string {
        if (this.isNew) {
            return "Nieuwe optie"
        }
        return "Optie bewerken"
    }

    get name() {
        return this.patchedChoice.name
    }

    set name(name: string) {
        this.patchChoice = this.patchChoice.patch({ name })
    }

    get description() {
        return this.patchedChoice.description
    }

    set description(description: string) {
        this.patchChoice = this.patchChoice.patch({ description })
    }

    get warningInverted() {
        return this.patchedChoice.warning?.inverted ?? null
    }

    set warningInverted(inverted: boolean | null) {
        if (inverted === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
            })
            return
        }
        if (this.warningInverted === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    inverted
                })
            })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    inverted
                })
            })
        }
    }

    get warningText() {
        return this.patchedChoice.warning?.text ?? null
    }

    set warningText(text: string | null) {
        if (text === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
            })
            return
        }
        if (this.warningText === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    text
                })
            })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    text
                })
            })
        }
    }

    get warningType() {
        return this.patchedChoice.warning?.type ?? null
    }

    set warningType(type: RecordWarningType | null) {
        if (type === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
            })
            return
        }
        if (this.warningType === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    type
                })
            })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    type
                })
            })
        }
    }

    addPatch(patch: AutoEncoderPatchType<RecordChoice>) {
        this.patchChoice = this.patchChoice.patch(patch)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedChoice)
        } else {
            arrayPatch.addPatch(this.patchChoice)
        }

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze optie wilt verwijderen?", "Verwijderen")) {
            return
        }

        if (this.isNew) {
            // do nothing
            this.pop({ force: true })
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        arrayPatch.addDelete(this.choice.id)

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    get hasChanges() {
        return patchContainsChanges(this.patchChoice, this.choice, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>
