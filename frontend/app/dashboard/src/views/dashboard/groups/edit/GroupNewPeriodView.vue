<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" class="group-edit-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p>
            Alle leden worden uitgeschreven (je kan de vorig ingeschreven leden altijd makkelijk terugvinden), en moeten daarna opnieuw inschrijven als ze hun lidmaatschap willen verlengen. <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/overgang-nieuw-werkjaar/'" target="_blank">Lees alles hier na.</a>
            <br><br>
            Pas hieronder de start- en einddata aan voor de nieuw periode.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Naam" error-fields="settings.name" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze groep"
                autocomplete=""
            >
        </STInputBox>
        <p v-if="duplicateName" class="warning-box">
            Er bestaat al een andere inschrijvingsgroep met dezelfde naam. Dit kan voor onduidelijkheid zorgen aangezien de categorie niet altijd zichtbaar is.
        </p>

        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="settings.startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="displayStartEndTime" v-model="startDate" title="Vanaf welk tijdstip" :validator="validator" /> 
        </div>
                

        <div class="split-inputs">
            <STInputBox title="Einddatum" error-fields="settings.endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-if="displayStartEndTime" v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
        </div>

        <Checkbox v-model="displayStartEndTime">
            Start- en eindtijdstip toevoegen
        </Checkbox>

        <p class="st-list-description">
            De start- en einddatum is zichtbaar bij het inschrijven en is puur informatief.
        </p>

        <hr>

        <Checkbox v-model="useRegistrationStartDate">
            Inschrijvingen pas mogelijk vanaf een bepaalde datum
        </Checkbox>

        <div v-if="useRegistrationStartDate" class="split-inputs">
            <STInputBox title="Inschrijven start op" error-fields="settings.registrationStartDate" :error-box="errorBox">
                <DateSelection v-model="registrationStartDate" />
            </STInputBox>
            <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" title="Vanaf" :validator="validator" /> 
        </div>

        <Checkbox v-model="useRegistrationEndDate">
            Inschrijvingen sluiten na een bepaalde datum
        </Checkbox>
                
        <div v-if="useRegistrationEndDate" class="split-inputs">
            <STInputBox title="Inschrijven sluit op" error-fields="settings.registrationEndDate" :error-box="errorBox">
                <DateSelection v-model="registrationEndDate" />
            </STInputBox>
            <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" title="Tot welk tijdstip" :validator="validator" />
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, SaveView, SegmentedControl, Slider, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton } from "@stamhoofd/components";
import { CycleInformation, Group, GroupGenderType, GroupSettings, GroupStatus, Image, ResolutionFit, ResolutionRequest, WaitingListType } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import GroupPermissionRow from "../../admins/GroupPermissionRow.vue";
import EditGroupPriceBox from "../EditGroupPriceBox.vue";
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
        EditGroupPriceBox,
        STList,
        GroupPermissionRow,
        UploadButton,
        STListItem
    },
})
export default class GroupNewPeriodView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Nieuwe inschrijvingsperiode';
    }

    get duplicateName() {
        return !!this.patchedOrganization.groups.find(g => StringCompare.typoCount(g.settings.name, this.patchedGroup.settings.name) === 0 && g.id !== this.patchedGroup.id)
    }

    mounted() {
        // Remove all numbers from the name and increase the cycle
        this.name = this.patchedGroup.settings.name.replace(/[0-9]/g, '').trim()
        const cycle = this.patchedGroup.cycle + 1;

        const settingsPatch = GroupSettings.patch({});
        settingsPatch.cycleSettings = new Map(this.patchedGroup.settings.cycleSettings)
        settingsPatch.cycleSettings.set(cycle - 1, CycleInformation.create({
            startDate: this.patchedGroup.settings.startDate,
            endDate: this.patchedGroup.settings.endDate,
            registeredMembers: this.patchedGroup.settings.registeredMembers,
            waitingListSize: this.patchedGroup.settings.waitingListSize,
            reservedMembers: this.patchedGroup.settings.reservedMembers,
        }))
        
        const p = Group.patch({
            cycle: cycle,
            settings: settingsPatch
        });
        this.addPatch(p)
    }

    get hasWaitingList() {
        return !!this.patchedGroup.settings.waitingListSize
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }

    get name() {
        return this.patchedGroup.settings.name
    }

    set name(name: string) {
        this.addSettingsPatch({ name })
    }

    get location() {
        return this.patchedGroup.settings.location
    }

    set location(location: string) {
        this.addSettingsPatch({ location })
    }

    get displayStartEndTime() {
        return this.patchedGroup.settings.displayStartEndTime
    }

    set displayStartEndTime(displayStartEndTime: boolean) {
        this.addSettingsPatch({ displayStartEndTime })

        if (!displayStartEndTime) {
            // Change dates
            const start = new Date(this.startDate)
            start.setHours(0, 0, 0, 0)
            this.startDate = start

            const end = new Date(this.endDate)
            end.setHours(23, 59, 59, 0)
            this.endDate = end
        }
    }

    get description() {
        return this.patchedGroup.settings.description
    }

    set description(description: string) {
        this.addSettingsPatch({ description })
    }

    get startDate() {
        return this.patchedGroup.settings.startDate
    }

    set startDate(startDate: Date) {
        this.addSettingsPatch({ startDate })
    }

    get endDate() {
        return this.patchedGroup.settings.endDate
    }

    set endDate(endDate: Date) {
        this.addSettingsPatch({ endDate })
    }

    get startYear() {
        return this.startDate.getFullYear()
    }

    get useRegistrationStartDate() {
        return this.patchedGroup.settings.registrationStartDate !== null
    }

    set useRegistrationStartDate(useRegistrationStartDate: boolean) {
        if (useRegistrationStartDate === this.useRegistrationStartDate) {
            return
        }
        if (useRegistrationStartDate) {
            this.registrationStartDate = new Date(this.startDate)
        } else {
            this.registrationStartDate = null
        }
    }

    get useRegistrationEndDate() {
        return this.patchedGroup.settings.registrationEndDate !== null
    }

    set useRegistrationEndDate(useRegistrationEndDate: boolean) {
        if (useRegistrationEndDate === this.useRegistrationEndDate) {
            return
        }
        if (useRegistrationEndDate) {
            this.registrationEndDate = new Date(this.endDate)
        } else {
            this.registrationEndDate = null
        }
    }

    get registrationStartDate() {
        return this.patchedGroup.settings.registrationStartDate
    }

    set registrationStartDate(registrationStartDate: Date | null) {
        this.addSettingsPatch({ registrationStartDate })

        if (registrationStartDate && registrationStartDate > new Date()) {
            this.addPatch(Group.patch({
                status: GroupStatus.Open
            }))
        }
    }

    get registrationEndDate() {
        return this.patchedGroup.settings.registrationEndDate
    }

    set registrationEndDate(registrationEndDate: Date | null) {
        this.addSettingsPatch({ registrationEndDate })
    }

    get genderType() {
        return this.patchedGroup.settings.genderType
    }

    set genderType(genderType: GroupGenderType) {
        this.addSettingsPatch({ genderType })
    }

    // Birth years
    get minAge() {
        return this.patchedGroup.settings.minAge
    }

    set minAge(minAge: number | null) {
        this.addSettingsPatch({ minAge })
    }

    get maxAge() {
        return this.patchedGroup.settings.maxAge
    }
    
    set maxAge(maxAge: number | null) {
        this.addSettingsPatch({ maxAge })
    }

    get genderTypes() {
        return [
            {
                value: GroupGenderType.Mixed,
                name: "Gemengd",
            },
            {
                value: GroupGenderType.OnlyFemale,
                name: "Enkel meisjes",
            },
            {
                value: GroupGenderType.OnlyMale,
                name: "Enkel jongens",
            },
        ]
    }

    // Waiting list

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

    // Cover picture
    get coverPhoto() {
        return this.patchedGroup.settings.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            coverPhoto
        }))
    }

    get hs() {
        return [
            ResolutionRequest.create({
                width: 1600
            }),
            ResolutionRequest.create({
                width: 800
            }),
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get coverPhotoResolution() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(800, 200)
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return this.coverPhotoResolution?.file.getPublicPath()
    }
    
    get coverImageWidth() {
        return this.coverPhotoResolution?.width
    }

    get coverImageHeight() {
        return this.coverPhotoResolution?.height
    }

    // Cover picture
    get squarePhoto() {
        return this.patchedGroup.settings.squarePhoto
    }

    set squarePhoto(squarePhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            squarePhoto
        }))
    }

    get hsSquare() {
        return [
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get squarePhotoSrc() {
        const image = this.squarePhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(250, 250).file.getPublicPath()
    }

}
</script>
