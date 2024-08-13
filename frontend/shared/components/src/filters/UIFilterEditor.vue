<template>
    <form class="st-view" data-submit-last-field @submit.prevent="applyFilter">
        <STNavigationBar v-if="!popup || canDelete || canPop" :title="filter.name" :disable-dismiss="canPop">
            <template v-if="canDelete" #right>
                <button class="button icon trash" type="button" @click="deleteFilter" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="!live">
                {{ filter.name ? filter.name : filter.builder.name }}
            </h1>
            
            <FramedComponent :root="filterComponent" />
        </main>

        <STToolbar v-if="!live || !popup">
            <template #right>
                <button class="button primary full" type="button" @click="applyFilter">
                    Toepassen
                </button>
            </template>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { FramedComponent, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import Radio from "../inputs/Radio.vue";
import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";
import STNavigationBar from "../navigation/STNavigationBar.vue";
import STToolbar from "../navigation/STToolbar.vue";
import { CenteredMessage } from "../overlays/CenteredMessage";
import { UIFilter } from './UIFilter';

@Component({
    components: {
        STListItem,
        STList,
        Radio,
        STNavigationBar,
        STToolbar,
        FramedComponent
    }
})
export default class UIFilterEditor extends Mixins(NavigationMixin) {
    @Prop({ required: true }) 
        filter!: UIFilter

    @Prop({ required: false }) 
        saveHandler!: ((filter: UIFilter) => void)|null
    
    @Prop({ required: false, default: null }) 
        deleteHandler!: (() => void)|null

    clonedFilter: UIFilter|null = null
    filterComponent: any = null;

    get live() {
        return !this.saveHandler
    }

    created() {
        if (this.live) {
            this.clonedFilter = this.filter
        } else {
            this.clonedFilter = this.filter.clone()
        }

        this.filterComponent = this.clonedFilter.getComponent()
    }

    applyFilter() {
        if (!this.saveHandler) {
            this.pop({force: true});
            return;
        }

        this.saveHandler(this.clonedFilter!);
        
        this.$nextTick(() => {
            this.pop({force: true});
        })
    }

    get canDelete() {
        return !!this.deleteHandler
    }

    deleteFilter() {
        if (!this.deleteHandler) {
            return;
        }
        this.deleteHandler();
        
        this.$nextTick(() => {
            this.pop({force: true});
        })
    }

    async shouldNavigateAway() {
        if (this.live) {
            return true;
        }

        const changed = JSON.stringify(this.filter.build()) !== JSON.stringify(this.clonedFilter!.build())
        if (!changed) {
            return true
        }
        return await CenteredMessage.confirm("Filter niet opslaan?", "Niet opslaan")
    }
}
</script>
