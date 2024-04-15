<template>
    <SaveView :loading="saving" :title="isNew ? 'Nieuwe groep toevoegen' : name+' bewerken'" :disabled="!hasChanges" class="group-edit-view" @save="save">
        <h1 v-if="isNew">
            Nieuwe groep toevoegen
        </h1>
        <h1 v-else>
            Algemene instellingen
        </h1>

        
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

        <template v-if="isNew && roles.length">
            <hr>
            <h2>Toegangsbeheer</h2>
            <p>Kies welke beheerdersrollen toegang hebben tot deze inschrijvingsgroep (hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders)</p>
            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem>
                    <Checkbox slot="left" :checked="true" :disabled="true" />
                    Hoofdbeheerders
                </STListItem>

                <GroupPermissionRow v-for="role in roles" :key="role.id" :role="role" :show-role="true" :organization="patchedOrganization" :group="patchedGroup" @patch="addOrganizationPatch" />
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, SaveView, SegmentedControl, Slider, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton } from "@stamhoofd/components";
import { Group, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, Image, PermissionLevel, PermissionRole, PermissionsByRole, ResolutionFit, ResolutionRequest, WaitingListType } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
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
export default class EditGroupGeneralView extends Mixins(EditGroupMixin) {
    get duplicateName() {
        return !!this.patchedOrganization.groups.find(g => StringCompare.typoCount(g.settings.name, this.patchedGroup.settings.name) === 0 && g.id !== this.patchedGroup.id)
    }

    mounted() {
        // Auto assign roles
        if (this.isNew && OrganizationManager.user.permissions && !this.group.privateSettings!.permissions.hasFullAccess(OrganizationManager.user.permissions, this.patchedOrganization.privateMeta?.roles ?? [])) {
            const categories = this.patchedOrganization.meta.categories.filter(c => c.groupIds.includes(this.group.id))
            for (const cat of categories) {
                // Get all roles that have create permissions in the categories that this group will get added into
                const roles = cat.settings.permissions.create.flatMap(r => {
                    const role = OrganizationManager.organization.privateMeta?.roles.find(i => i.id === r.id)
                    const has = OrganizationManager.user.permissions?.roles.find(i => i.id === r.id)
                    if (role && has) {
                        return [PermissionRole.create(role)]
                    }
                    return []
                })

                if (roles.length > 0) {
                    const permissions = PermissionsByRole.patch({})
                    for (const role of roles) {
                        permissions.full.addPut(role)
                    }
                    this.addPrivateSettingsPatch(GroupPrivateSettings.patch({
                        permissions
                    }))
                }
                
            }
        }
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: calc(750 / 1800 * 100%);
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }

    .square-photo {
        img {
            height: 200px;
            width: 200px;
            border-radius: $border-radius;
            object-fit: contain;
        }
    }

}
</style>
