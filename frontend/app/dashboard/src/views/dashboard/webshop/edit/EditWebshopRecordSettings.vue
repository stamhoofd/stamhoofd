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
                <template #left>
                    <Checkbox v-model="phoneEnabled" />
                </template>
                <p class="style-title-list">
                    {{ $t('shared.inputs.mobile.label') }}
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Vragenlijsten tijdens afrekenen</h2>

        <p>
            Voeg zelf vragenlijsten toe die ingevuld kunnen worden bij het plaatsen van een bestelling (na de ingebouwde gegevens). <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">Meer info</a>
        </p>

        <STList v-model="categories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="editorSettings" @patch="addCategoriesPatch" @edit="editCategory" />
            </template>
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
import { PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, EditRecordCategoryView, RecordCategoryRow, RecordEditorSettings, STErrorsDefault, STList, STListItem, SaveView, checkoutUIFilterBuilders } from "@stamhoofd/components";
import { Checkout, PatchAnswers, PrivateWebshop, RecordCategory, WebshopMetaData } from "@stamhoofd/structures";
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
            filterBuilder: (_categories: RecordCategory[]) => {
                return checkoutUIFilterBuilders[0]
            },
            exampleValue: Checkout.create({}),
            patchExampleValue(checkout, patch: PatchAnswers) {
                return checkout.patch(
                    Checkout.patch({
                        recordAnswers: patch
                    })
                )
            }
        })
    }

    addCategory() {
        const category = RecordCategory.create({});
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
        arr.addPut(category)

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditRecordCategoryView, {
                        categoryId: category.id,
                        rootCategories: [...this.categories, category],
                        settings: this.editorSettings,
                        isNew: true,
                        allowChildCategories: true,
                        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                            this.addCategoriesPatch(arr.patch(patch))
                        }
                    })
                })
            ],
            modalDisplayStyle: "popup"
        });
    }

    editCategory(category: RecordCategory) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditRecordCategoryView, {
                        categoryId: category.id,
                        rootCategories: this.categories,
                        settings: this.editorSettings,
                        isNew: false,
                        allowChildCategories: true,
                        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                            this.addCategoriesPatch(patch)
                        }
                    })
                })
            ],
            modalDisplayStyle: "popup"
        });
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
