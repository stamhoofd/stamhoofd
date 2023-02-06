<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsperiode" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Kies een inschrijvingsperiode</h1>
            <p>Kies heel zorgvuldig, want de naamgeving kan verwarrend zijn afhankelijk of je al een nieuwe periode had gestart of niet. Dit is een concept dat in de toekomst van Stamhoofd daarom waarschijnlijk ook vervangen zal worden door een archieffunctie.</p>

            <STList>
                <STListItem v-for="cycle of cycles" :key="cycle.cycle" :selectable="true" @click="selectCycle(cycle.cycle)">
                    <h2 class="style-title-list">
                        {{ cycle.name }}
                    </h2>
                    <p class="style-description-small">
                        {{ cycle.description }}
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, FillRecordCategoryView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { DocumentTemplateGroup, Group, RecordAnswer, RecordCategory } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";

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
        addGroup: (group: DocumentTemplateGroup) => void

    @Prop({ required: true }) 
        group!: Group

    @Prop({ required: true }) 
        fieldCategories!: RecordCategory[]

    // fetch all counts and dates for the last 3 cycles of this group

    cycles = [
        {
            cycle: this.group.cycle,
            name: "Huidige periode",
            description: "Bezig met info ophalen...",
            loading: true
        },
        {
            cycle: this.group.cycle - 1,
            name: "Vorige inschrijvingsperiode",
            description: "Bezig met info ophalen...",
            loading: true
        },
        {
            cycle: this.group.cycle - 2,
            name: "Twee inschrijvingsperiodes geleden",
            description: "Bezig met info ophalen...",
            loading: true
        },
        ...new Array(Math.max(this.group.cycle - 2, 0)).fill(0).map((_, index) => {
            return {
                cycle: this.group.cycle - 3 - index,
                name: (index + 3) + " inschrijvingsperiodes geleden",
                description: "Bezig met info ophalen...",
                loading: true
            }
        })
    ]

    canceled = false

    mounted() {
        this.fetchCounts().catch(console.error)
    }

    async fetchCounts() {
        // fetch counts and registration dates for all cycles
        for (const cycle of this.cycles) {
            if (this.canceled) {
                // Component was destroyed
                return
            }
            cycle.loading =  true
            try {
                const members = await MemberManager.loadMembers([this.group.id], false, this.group.cycle - cycle.cycle, this)
                let minDate: Date | null = null
                let maxDate: Date | null = null

                for (const member of members) {
                    const regs = member.filterRegistrations({ groups: [this.group], cycleOffset: this.group.cycle - cycle.cycle, waitingList: false })
                    if (regs.length > 0) {
                        const reg = regs[0]
                        if (reg.registeredAt) {
                            if (minDate === null || reg.registeredAt < minDate) {
                                minDate = reg.registeredAt
                            }
                            if (maxDate === null || reg.registeredAt > maxDate) {
                                maxDate = reg.registeredAt
                            }
                        }
                    }
                }

                let dateDescription = '';
                if (minDate && maxDate) {
                    const minStr = Formatter.dateNumber(minDate, true)
                    const maxStr = Formatter.dateNumber(maxDate, true)
                    if (minStr === maxStr) {
                        dateDescription = " op " + minStr
                    } else {
                        dateDescription = " tussen " + minStr + " en " + maxStr
                    }
                }
                cycle.description = members.length + (members.length !== 1 ? " leden" : " lid") + " ingeschreven" + dateDescription
            } catch (e) {
                cycle.description = "Ophalen informatie mislukt"
            }
            cycle.loading = false

        }
    }

    beforeDestroy() {
        this.canceled = true
        Request.cancelAll(this)
    }

    selectCycle(cycle: number) {
        const group = DocumentTemplateGroup.create({
            groupId: this.group.id,
            cycle
        })
        this.gotoRecordCategory(group, 0)
    }

    gotoRecordCategory(group: DocumentTemplateGroup, index: number) {
        if (index >= this.fieldCategories.length) {
            this.addGroup(group)
            this.dismiss({force: true})
            return
        }
        const category = this.fieldCategories[index]
        this.show({
            components: [
                new ComponentWithProperties(FillRecordCategoryView, {
                    category,
                    answers: group.fieldAnswers,
                    markReviewed: true,
                    dataPermission: true,
                    filterDefinitions: [],
                    saveHandler: (fieldAnswers: RecordAnswer[], component: NavigationMixin) => {
                        const g = group.patch({
                            fieldAnswers: fieldAnswers as any
                        })
                        this.gotoRecordCategory(g, index+1)
                    },
                    filterValueForAnswers: (fieldAnswers: RecordAnswer[]) => {
                        return group.patch({
                            fieldAnswers: fieldAnswers as any
                        })
                    },
                })
            ]
        })
    }
}
</script>