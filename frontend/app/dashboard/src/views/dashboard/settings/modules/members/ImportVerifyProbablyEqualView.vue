<template>
    <div class="st-view">
        <STNavigationBar title="Lijken op elkaar" />

        <main>
            <h1>
                Vink de rijen aan als het om dezelfde personen gaat
            </h1>
            <p>We zijn niet 100% zeker dat deze leden uit Stamhoofd en jouw bestand op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum). Kan je dit manueel verifiëren? De linkse gegevens uit jouw bestand zullen de rechtse (= uit Stamhoofd) overschrijven als je ze aanvinkt.</p>
        
            <button v-if="!isCheckedAll" class="button text" type="button" @click="checkAll">
                Alles aanvinken
            </button>
            <button v-else class="button text" type="button" @click="uncheckAll">
                Alles uitvinken
            </button>

            <STList>
                <STListItem v-for="(match, index) in members" :key="index" element-name="label" :selectable="true">
                    <div>
                        <h2 class="style-title-list">
                            {{ match.details.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.details.birthDayFormatted || "/" }}
                        </p>
                    </div>

                    <template #right><div>
                        <h2 class="style-title-list">
                            {{ match.probablyEqual.details.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.probablyEqual.details.birthDayFormatted || "/" }}
                        </p>
                    </div></template>

                    <template #left>
                        <Checkbox :model-value="getVerified(match)" @update:model-value="setVerified(match, $event)" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="goNext">
                    Verder
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { ImportingMember } from "../../../../../classes/import/ImportingMember";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STList,
        STListItem,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class ImportVerifyProbablyEqualView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        onVerified: (component: NavigationMixin) => void
    
    @Prop({ required: true })
        members: ImportingMember[]
    
    goNext() {
        this.onVerified(this)
    }

    getVerified(member: ImportingMember) {
        return !!member.equal
    }

    get isCheckedAll() {
        for (const member of this.members) {
            if (!this.getVerified(member)) {
                return false
            }
        }
        return true
    }

    checkAll() {
        for (const member of this.members) {
            this.setVerified(member, true)
        }
    }

    uncheckAll() {
        for (const member of this.members) {
            this.setVerified(member, false)
        }
    }

    setVerified(member: ImportingMember, value: boolean) {
        if (value) {
            member.equal = member.probablyEqual
        } else {
            member.equal = null
        }
    }
}

</script>