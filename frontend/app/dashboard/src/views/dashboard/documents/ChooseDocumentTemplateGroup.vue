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
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>
                </STList>
            </div>

            <hr>
            <h2>Archief</h2>
            <Spinner v-if="loadingGroups" />
            <STList v-else-if="archivedGroups.length">
                <STListItem v-for="group in archivedGroups" :key="group.id" :selectable="true" @click="selectGroup(group)">
                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                Het archief is leeg.
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Spinner, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { DocumentTemplateGroup, Group, RecordCategory } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


import ChooseDocumentTemplateCycle from "./ChooseDocumentTemplateCycle.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        BackButton,
        Spinner
    }
})
export default class ChooseDocumentTemplateGroup extends Mixins(NavigationMixin){
    @Prop({ required: true }) 
        addGroup: (group: DocumentTemplateGroup, component: NavigationMixin) => void
        
    @Prop({ required: true }) 
        fieldCategories!: RecordCategory[]

    archivedGroups: Group[] = []
    loadingGroups = true

    get categoryTree() {
        return this.$organization.getCategoryTree({maxDepth: 1, admin: true, smartCombine: true})
    }

    selectGroup(group: Group) {
        if (group.cycle === 0) {
            this.addGroup(DocumentTemplateGroup.create({
                groupId: group.id,
                cycle: group.cycle
            }), this);
            return;
        }
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

    mounted() {
        this.load().catch(console.error)
    }

    beforeUnmount() {
        // Cancel all requests
        Request.cancelAll(this)
    }

    async load() {
        try {
            this.archivedGroups = await this.$organizationManager.loadArchivedGroups({owner: this})
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loadingGroups = false
    }
}
</script>