<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsgroep" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Kies een inschrijvingsgroep</h1>

            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" @click="selectGroup(group)">
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { DocumentTemplateGroup, Group, RecordCategory } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ChooseDocumentTemplateCycle from "./ChooseDocumentTemplateCycle.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        BackButton
    }
})
export default class ChooseDocumentTemplateGroup extends Mixins(NavigationMixin){
    @Prop({ required: true }) 
        addGroup: (group: DocumentTemplateGroup) => void
        
    @Prop({ required: true }) 
        fieldCategories!: RecordCategory[]

    get categoryTree() {
        return OrganizationManager.organization.getCategoryTree({maxDepth: 1, admin: true, smartCombine: true})
    }

    selectGroup(group: Group) {
        this.show({
            components: [
                new ComponentWithProperties(ChooseDocumentTemplateCycle, { 
                    group, 
                    fieldCategories: this.fieldCategories,
                    addGroup: this.addGroup 
                })
            ]
        })
    }
}
</script>