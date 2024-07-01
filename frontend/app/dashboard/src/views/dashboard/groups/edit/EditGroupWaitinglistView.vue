<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Maximum aantal leden</h2>

        <Checkbox v-model="enableMaxMembers">
            Limiteer maximum aantal ingeschreven leden
        </Checkbox>

        <Checkbox v-if="enableMaxMembers" v-model="waitingListIfFull">
            Wachtlijst als maximum is bereikt
        </Checkbox>

        <STInputBox v-if="enableMaxMembers" title="Maximaal aantal ingeschreven leden">
            <Slider v-model="maxMembers" :max="200" />
        </STInputBox>

        <p v-if="enableMaxMembers" class="style-description-small">
            Bij online betalingen wordt de plaats maximaal 30 minuten vrijgehouden als mensen op de betaalpagina zijn. Normaal kan de betaling daarna niet meer doorkomen. Door een trage verwerking van de bank of een storing bij de bank kan het zijn dat het langer dan 30 minuten duurt voor we een betaalbevestiging krijgen van de bank, dan kunnen we de betaling niet meer weigeren (beperking van bank). Het kan dus zijn dat in die uitzonderlijke situaties, het maximum aantal overschreven wordt. Je kan daarna eventueel zelf overgaan tot terugbetalen en uitschrijven. 
        </p>

        <hr>
        <h2>Wachtlijst en voorinschrijvingen</h2>

        <STInputBox error-fields="waitingListType" :error-box="errorBox" class="max">
            <RadioGroup class="column">
                <Radio v-model="waitingListType" value="None">
                    Geen speciale regeling
                </Radio>
                <Radio v-model="waitingListType" value="ExistingMembersFirst">
                    Alle nieuwe leden op wachtlijst<span class="radio-description">Bestaande leden kunnen meteen inschrijven (tot het maximum). De rest komt op de wachtlijst.</span>
                </Radio>
                <Radio v-model="waitingListType" value="PreRegistrations">
                    Voorinschrijvingen gebruiken <span class="radio-description">Bestaande leden kunnen al vroeger beginnen met inschrijven.</span>
                </Radio>
                <Radio v-model="waitingListType" value="All">
                    Iedereen op wachtlijst <span class="radio-description">Iedereen moet manueel worden goedgekeurd.</span>
                </Radio>
            </RadioGroup>
        </STInputBox>

        <div v-if="waitingListType == 'PreRegistrations'" class="split-inputs">
            <STInputBox title="Begindatum voorinschrijvingen" error-fields="settings.preRegistrationsDate" :error-box="errorBox">
                <DateSelection v-model="preRegistrationsDate" />
            </STInputBox>
                    
            <TimeInput v-model="preRegistrationsDate" title="Vanaf" :validator="validator" /> 
        </div>
                
        <Checkbox v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" v-model="priorityForFamily">
            Naast bestaande leden ook voorrang geven aan broers/zussen
        </Checkbox>

        <p v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" class="info-box">
            Leden worden als bestaand beschouwd als ze ingeschreven zijn voor een vorige inschrijvingsperiode van gelijk welke inschrijvingsgroep. Let er dus op dat die leden ook in Stamhoofd zijn ingeladen. Je kan leden van vorig jaar importeren via Excel en bij de importeer-instellingen aanduiden dat het gaat om leden van vorig jaar. Leden moeten wel inloggen met een e-mailadres dat verbonden is met een bestaand account. Daarom verstuur je best een e-mail naar alle leden met de magische knop waarmee ze automatisch met het juiste account inloggen (of registreren).
        </p>
    </SaveView>
</template>

<script lang="ts">
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, SaveView, SegmentedControl, Slider, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton } from "@stamhoofd/components";
import { WaitingListType } from '@stamhoofd/structures';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        TimeInput,
        STList,
        UploadButton,
        STListItem
    },
})
export default class EditGroupWaitinglistView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Wachtlijst en voorinschrijvingen'
    }

    get startDate() {
        return this.patchedGroup.settings.startDate
    }

  
    get waitingListType() {
        return this.patchedGroup.settings.waitingListType
    }

    set waitingListType(waitingListType: WaitingListType) {
        this.addSettingsPatch({ waitingListType })

        if (waitingListType === WaitingListType.PreRegistrations && this.preRegistrationsDate === null) {
            const d = new Date(this.startDate)
            d.setMonth(d.getMonth() - 1)
            this.preRegistrationsDate = d
        }
    }

    get preRegistrationsDate() {
        return this.patchedGroup.settings.preRegistrationsDate
    }

    set preRegistrationsDate(preRegistrationsDate: Date | null) {
        this.addSettingsPatch({ preRegistrationsDate })
    }

    get waitingListIfFull() {
        return this.patchedGroup.settings.waitingListIfFull
    }

    set waitingListIfFull(waitingListIfFull: boolean) {
        this.addSettingsPatch({ waitingListIfFull })
    }

    get enableMaxMembers() {
        return this.maxMembers !== null
    }

    set enableMaxMembers(enableMaxMembers: boolean) {
        if (enableMaxMembers === this.enableMaxMembers) {
            return
        }
        if (enableMaxMembers) {
            this.maxMembers = 200
        } else {
            this.maxMembers = null
        }
    }

    get maxMembers() {
        return this.patchedGroup.settings.maxMembers
    }

    set maxMembers(maxMembers: number | null) {
        this.addSettingsPatch({ maxMembers })
    }

    get priorityForFamily() {
        return this.patchedGroup.settings.priorityForFamily
    }

    set priorityForFamily(priorityForFamily: boolean) {
        this.addSettingsPatch({ priorityForFamily })
    }
}
</script>
