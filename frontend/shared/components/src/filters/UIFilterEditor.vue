<template>
    <form class="st-view" data-submit-last-field @submit.prevent="applyFilter">
        <STNavigationBar :title="filter.name" :dismiss="!canPop" :pop="canPop">
            <button v-if="canDelete" slot="right" class="button icon trash" type="button" @click="deleteFilter" />
        </STNavigationBar>

        <main>
            <h1 v-if="!live">
                {{ filter.name ? filter.name : filter.builder.name }}
            </h1>
            
            <FramedComponent :root="filterComponent" />
        </main>

        <STToolbar v-if="!live">
            <button slot="right" class="button primary full" type="button" @click="applyFilter">
                Toepassen
            </button>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { FramedComponent,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Radio, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

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