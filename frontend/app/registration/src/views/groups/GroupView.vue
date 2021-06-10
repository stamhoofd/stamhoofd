<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                {{ group.settings.name }}
                <GroupTag :group="group" />
            </h1>
            <figure v-if="coverPhotoSrc" class="cover-photo">
                <img :src="coverPhotoSrc">
            </figure>
            <p v-if="group.settings.description" class="style-description" v-text="group.settings.description" />

            <p v-if="infoBox" class="info-box">
                {{ infoBox }}
            </p>

            <p v-if="infoBox2" class="info-box">
                {{ infoBox2 }}
            </p>

            <p v-if="errorBox" class="error-box">
                {{ errorBox }}
            </p>

            <STList class="group-info-list">
                <STListItem class="right-description">
                    Wanneer?

                    <template v-if="group.settings.displayStartEndTime" slot="right">
                        {{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}
                    </template>
                    <template v-else slot="right">
                        {{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}
                    </template>
                </STListItem>
                <STListItem v-if="group.settings.location" class="right-description">
                    Waar?

                    <template slot="right">
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem class="right-description wrap">
                    Wie?

                    <div slot="right" v-text="who" />
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="isSignedIn && registerButton && !closed">
            <button slot="right" class="primary button" @click="chooseMembers">
                <span class="icon add" />
                <span>Inschrijven</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { Group, GroupGenderType, WaitingListType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../dashboard/src/classes/OrganizationManager";
import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from "../../classes/MemberManager";
import GroupTag from "../../components/GroupTag.vue"
import MemberBox from "../../components/MemberBox.vue"
import GroupMemberSelectionView from "./GroupMemberSelectionView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox,
        GroupTag
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group!: Group

    @Prop({ default: true })
    registerButton!: boolean

    MemberManager = MemberManager
    SessionManager = SessionManager

    get members() {
        return this.MemberManager.members ?? []
    }

    get isSignedIn() {
        return SessionManager.currentSession && SessionManager.currentSession.isComplete()
    }

    get closed() {
        return this.group.closed
    }

    get now() {
        return new Date()
    }

    chooseMembers() {
        this.show(new ComponentWithProperties(GroupMemberSelectionView, { group: this.group }))
    }

    get coverPhotoSrc() {
        const image = this.group.settings.coverPhoto
        if (!image) {
            return null
        }
        return image.getPathForSize(1800, 750)
    }

    formatDateTime(date: Date) {
        return Formatter.dateTime(date)
    }

    formatDate(date: Date) {
        return Formatter.date(date)
    }

    get infoBox() {
        if (this.group.settings.registrationStartDate > this.now) {
            if (this.group.activePreRegistrationDate) {
                if (this.group.settings.priorityForFamily) {
                    return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate, true)
                        + ". Bestaande leden en broers/zussen kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!, true) + "."
                }
                return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate, true)
                        + ". Bestaande leden kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!, true) + "."
            }
            return "De inschrijvingen gaan open op "+ Formatter.dateTime(this.group.settings.registrationStartDate, true)
        }

        return null;
    }

    get infoBox2() {
        if (this.group.settings.registrationEndDate < this.now || this.group.settings.isFull) {
            return null
        }

        if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst) {
            if (this.group.settings.priorityForFamily) {
                return "Bestaande leden en broers en zussen kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten."
            }
            return "Bestaande leden kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten."
        }

        if (this.group.settings.waitingListType === WaitingListType.All) {
            return "Iedereen moet inschrijven op de wachtlijst"
        }
        

        return null;
    }

    get canRegister() {
        return !!this.members.find((m) => {
            const r = m.canRegister(this.group, MemberManager.members ?? [], OrganizationManager.organization.meta.categories, CheckoutManager.cart.items)
            return !r.closed && !r.waitingList
        })
    }


    get errorBox() {
        if (this.group.settings.registrationEndDate < this.now) {
            return "De inschrijvingen zijn afgelopen"
        }

        if (this.group.settings.isFull && !this.canRegister) {
            // Check if still possible
            if (this.group.settings.waitingListIfFull) {
                return "Helaas al volzet! Je kan enkel nog op de wachtlijst inschrijven."
            }
            return "Helaas al volzet!"
        }
        return null;
    }

    get who() {
        let who = ""

        if (this.group.settings.minAge && this.group.settings.maxAge) {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                if (this.group.settings.minAge >= 18) {
                    who += "Mannen geboren in"
                } else {
                    who += "Jongens geboren in"
                }
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                if (this.group.settings.minAge >= 18) {
                    who += "Vrouwen geboren in"
                } else {
                    who += "Meisjes geboren in"
                }
            } else {
                who += "Geboren in"
            }
            who += " " + (this.group.settings.startDate.getFullYear() - this.group.settings.maxAge) + " - " + (this.group.settings.startDate.getFullYear() - this.group.settings.minAge);
        } else if (this.group.settings.minAge) {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                if (this.group.settings.minAge >= 18) {
                    who += "Mannen geboren in of voor"
                } else {
                    who += "Jongens geboren in of voor"
                }
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                if (this.group.settings.minAge >= 18) {
                    who += "Vrouwen geboren in of voor"
                } else {
                    who += "Meisjes geboren in of voor"
                }
            } else {
                who += "Geboren in of voor"
            }
            who += " " + (this.group.settings.startDate.getFullYear() - this.group.settings.minAge);
        } else if (this.group.settings.maxAge) {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                if (this.group.settings.maxAge > 18) {
                    who += "Mannen geboren in of na"
                } else {
                    who += "Jongens geboren in of na"
                }
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                if (this.group.settings.maxAge > 18) {
                    who += "Vrouwen geboren in of na"
                } else {
                    who += "Meisjes geboren in of na"
                }
            } else {
                who += "Geboren in of na"
            }
            who += " " + (this.group.settings.startDate.getFullYear() - this.group.settings.maxAge);
        } else {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                who += "Mannen/jongens"
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                who += "Vrouwen/Meisjes"
            }
        }

        if (this.group.settings.requireGroupIds.length > 0) {
            const prefix = Formatter.joinLast(this.group.settings.requireGroupIds.map(id => OrganizationManager.organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (this.group.settings.preventPreviousGroupIds.length > 0) {
            const prefix = "Iedereen die de vorige keer niet ingeschreven was bij "+Formatter.joinLast(this.group.settings.preventPreviousGroupIds.map(id => OrganizationManager.organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (this.group.settings.requirePreviousGroupIds.length > 0) {
            const prefix = "Iedereen die de vorige keer ingeschreven was bij "+Formatter.joinLast(this.group.settings.requirePreviousGroupIds.map(id => OrganizationManager.organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (!who) {
            return "Iedereen kan inschrijven"
        }

        return who;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: 750/1800*100%;
        background: $color-gray;
        border-radius: $border-radius;
        margin-bottom: 20px;

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

    p + .group-info-list {
        margin-top: 20px;
    }
}
</style>