<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button class="button text" @click="editMe">
                    <span class="icon settings"/>
                    <span>Wijzigen</span>
                </button>
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
          
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="categories.length > 0">
                <STList>
                    <STListItem v-for="category in categories" :key="category.id" :selectable="true" @click="openCategory(category)">
                        {{ category.settings.name }}

                        <template slot="right">
                            <span  class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        {{group.settings.name }}

                        <template slot="right">
                            <span  class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator, STListItem, BackButton } from "@stamhoofd/components";
import { Group, GroupCategory } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
import GroupMembersView from "./GroupMembersView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        BackButton
    },
})
export default class CategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
    category: GroupCategory

    get reactiveCategory() {
        const c = this.organization.meta.categories.find(c => c.id === this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get organization() {
        return OrganizationManager.organization
    }

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen bewerken' : this.name+''
    }

    get name() {
        return this.reactiveCategory.settings.name
    }

    get groups() {
        return this.reactiveCategory.groupIds.flatMap(id => {
            const group = this.organization.groups.find(g => g.id === id)
            if (group) {
                return [group]
            }
            return []
        })
    }

    get categories() {
        return this.reactiveCategory.categoryIds.flatMap(id => {
            const category = this.organization.meta.categories.find(c => c.id === id)
            if (category) {
                return [category]
            }
            return []
        })
    }

    openCategory(category: GroupCategory) {
        this.show(new ComponentWithProperties(CategoryView, {
            category
        }))
    }

    openGroup(group: Group) {
        this.show(new ComponentWithProperties(GroupMembersView, {
            group
        }))
    }

    editMe() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditCategoryGroupsView, { 
                category: this.category, 
                organization: this.organization, 
                async saveHandler(patch) {
                    patch.id = this.organization.id
                    await OrganizationManager.patch(patch)
                }
            })
        }).setDisplayStyle("popup"))
    }
    
}
</script>
