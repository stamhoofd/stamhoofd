<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsperiode" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Kies een inschrijvingsperiode</h1>
            <p>Kies heel zorgvuldig.</p>

            <STList>
                <STListItem v-for="cycle of cycles" :key="cycle.cycle" :selectable="true" @click="selectCycle(cycle.cycle)">
                    <h2 class="style-title-list">
                        {{ cycle.name }}
                    </h2>
                    <p class="style-description">
                        {{ group.getTimeRange(cycle.cycle) }}
                    </p>

                    <span v-if="group.getMemberCount({cycle: cycle.cycle}) !== null" slot="right" class="style-description-small">{{ group.getMemberCount({cycle: cycle.cycle}) }}</span>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { DocumentTemplateGroup, Group, RecordCategory } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        BackButton
    }
})
export default class ChooseDocumentTemplateCycle extends Mixins(NavigationMixin){
    @Prop({ required: true }) 
        addGroup: (group: DocumentTemplateGroup, component: NavigationMixin) => void

    @Prop({ required: true }) 
        group!: Group

    @Prop({ required: true }) 
        fieldCategories!: RecordCategory[]

    get cycles() {
        const cycles = [
            {
                cycle: this.group.cycle,
                name: "Huidige periode",
            }
        ];
        for (let i = this.group.cycle - 1; i >= 0; i--) {
            const offset = this.group.cycle - i;
            cycles.push({
                cycle: i,
                name: offset === 1 ? ('Vorige inschrijvingsperiode') : (offset === 2 ? ('Twee inschrijvingsperiodes geleden') : (offset + " inschrijvingsperiodes geleden")),
            })
        }

        return cycles;
    }

    selectCycle(cycle: number) {
        const group = DocumentTemplateGroup.create({
            groupId: this.group.id,
            cycle
        })
        this.addGroup(group, this)
    }
}
</script>