<template>
    <SaveView :loading="saving" title="Vragenlijsten en gegevens" :disabled="!hasChanges" @save="save">
        <h1>
            Vragenlijsten en gegevens
        </h1>
        <p>Je kan zelf kiezen welke extra informatie je van bestellers wilt verzamelen.</p>
            
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Ingebouwde gegevens</h2>

        <p>Bepaalde gegevens zijn ingebouwd in Stamhoofd zodat we die ook op een speciale manier kunnen verwerken. Je kan deze hier aan of uit zetten.</p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <Checkbox slot="left" v-model="phoneEnabled" />
                <p class="style-title-list">
                    {{ $t('shared.inputs.mobile.label') }}
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Vragenlijsten tijdens afrekenen</h2>

        <STList v-model="categories" :draggable="true">
            <RecordCategoryRow v-for="category in categories" :key="category.id" :category="category" :categories="categories" :selectable="true" :settings="editorSettings" @patch="addCategoriesPatch" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span>Nieuwe vragenlijst</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts">
import { PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Checkbox, SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
import { Checkout } from "@stamhoofd/structures";
import { RecordEditorSettings } from "@stamhoofd/structures";
import { PrivateWebshop, RecordCategory, WebshopMetaData } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import EditRecordCategoryView from "../../settings/modules/members/records/EditRecordCategoryView.vue";
import RecordCategoryRow from "../../settings/modules/members/records/RecordCategoryRow.vue";
import EditWebshopMixin from './EditWebshopMixin';


@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STList,
        RecordCategoryRow,
        STListItem,
        Checkbox
    },
})
export default class EditWebshopRecordSettings extends Mixins(EditWebshopMixin) {
    get categories() {
        return this.webshop.meta.recordCategories;
    }

    set categories(recordCategories: RecordCategory[]) {
        this.addPatch(PrivateWebshop.patch({ 
            meta: WebshopMetaData.patch({
                recordCategories: recordCategories as any
            })
        }))
    }

    get phoneEnabled() {
        return this.webshop.meta.phoneEnabled;
    }

    set phoneEnabled(phoneEnabled: boolean) {
        this.addPatch(PrivateWebshop.patch({ 
            meta: WebshopMetaData.patch({
                phoneEnabled
            })
        }))
    }

    get editorSettings() {
        return new RecordEditorSettings({
            dataPermission: false,
            filterDefinitions: (categories: RecordCategory[]) => Checkout.getFilterDefinitions(this.webshop, categories),
            filterValueForAnswers: (answers) => Checkout.create({recordAnswers: answers})
        })
    }

    addCategory() {
        const category = RecordCategory.create({})

        this.present(new ComponentWithProperties(EditRecordCategoryView, {
            category,
            isNew: true,
            filterDefinitions: this.editorSettings.filterDefinitions(this.categories),
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                this.addCategoriesPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
        this.addPatch(PrivateWebshop.patch({ 
            meta: WebshopMetaData.patch({
                recordCategories: patch
            })
        }))
    }
}
</script>
