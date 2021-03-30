<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
            </template>
        </STNavigationBar>
        
        <main>
            <h1>{{ group.settings.name }}</h1>
            <figure v-if="coverPhotoSrc" class="cover-photo">
                <img :src="coverPhotoSrc">
            </figure>
            <p class="style-description" v-text="group.settings.description" />

            <p class="info-box" v-if="infoBox">
                {{ infoBox }}
            </p>

            <p class="error-box" v-if="errorBox">
                {{ errorBox }}
            </p>

            <STList>
                <STListItem class="right-description">
                    Wanneer?

                    <template slot="right" v-if="group.settings.displayStartEndTime">
                        {{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}
                    </template>
                    <template slot="right" v-else>
                        {{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}
                    </template>
                </STListItem>
                <STListItem v-if="group.settings.location" class="right-description">
                    Waar?

                    <template slot="right">
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Wie?

                    <template slot="right">
                        {{ who }}
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="!closed">
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
import { Group, GroupGenderType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
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
        MemberBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group!: Group

    MemberManager = MemberManager

    get members() {
        return this.MemberManager.members ?? []
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
                    return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate)
                        + ". Bestaande leden en broers/zussen kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!) + "."
                }
                return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate)
                        + ". Bestaande leden kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!) + "."
            }
            return "De inschrijvingen gaan open op "+ Formatter.dateTime(this.group.settings.registrationStartDate)
        }

        return null;
    }

    get errorBox() {
        if (this.group.settings.registrationEndDate < this.now) {
            return "De inschrijvingen zijn afgelopen"
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
                    who += "Mannen geboren in of na"
                } else {
                    who += "Jongens geboren in of na"
                }
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                if (this.group.settings.minAge >= 18) {
                    who += "Vrouwen geboren in of na"
                } else {
                    who += "Meisjes geboren in of na"
                }
            } else {
                who += "Geboren in of na"
            }
            who += " " + (this.group.settings.startDate.getFullYear() - this.group.settings.minAge);
        } else if (this.group.settings.maxAge) {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                if (this.group.settings.maxAge > 18) {
                    who += "Mannen geboren in of voor"
                } else {
                    who += "Jongens geboren in of voor"
                }
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                if (this.group.settings.maxAge > 18) {
                    who += "Vrouwen geboren in of voor"
                } else {
                    who += "Meisjes geboren in of voor"
                }
            } else {
                who += "Geboren in of voor"
            }
            who += " " + (this.group.settings.startDate.getFullYear() - this.group.settings.maxAge);
        } else {
            if (this.group.settings.genderType === GroupGenderType.OnlyMale) {
                who += "Mannen/jongens"
            } else if (this.group.settings.genderType === GroupGenderType.OnlyFemale) {
                who += "Vrouwen/Meisjes"
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
}
</style>