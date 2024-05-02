<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.name" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.name }}</span>
                <MaleIcon v-if="member.gender == 'Male'" v-tooltip="member.age >= 18 ? 'Man' : 'Jongen'" class="icon-spacer" />
                <FemaleIcon v-if="member.gender == 'Female'" v-tooltip="member.age >= 18 ? 'Vrouw' : 'Meisje'" class="icon-spacer" />
            </h1>

            <div class="container">
                <dl class="details-grid hover">
                    <dt>Vereniging</dt>
                    <dd v-copyable>
                        {{ member.organizationName }}
                    </dd>

                    <template v-if="member.firstName">
                        <dt>Voornaam</dt>
                        <dd v-copyable>
                            {{ member.firstName }}
                        </dd>
                    </template>

                    <template v-if="member.lastName">
                        <dt>Achternaam</dt>
                        <dd v-copyable>
                            {{ member.lastName }}
                        </dd>
                    </template>

                    <template v-if="member.birthDay">
                        <dt>Verjaardag</dt>
                        <dd v-copyable>
                            {{ birthDayFormatted }} ({{ member.age }} jaar)
                        </dd>
                    </template>

                    <template v-if="member.phone">
                        <dt>GSM-nummer</dt>
                        <dd v-copyable>
                            {{ member.phone }}
                        </dd>
                    </template>

                    <template v-if="member.email">
                        <dt>E-mailadres</dt>
                        <dd v-copyable>
                            {{ member.email }}
                        </dd>
                    </template>

                    <template v-if="member.address">
                        <dt>Adres</dt>
                        <dd v-copyable>
                            {{ member.address.street }} {{ member.address.number }}<br>{{ member.address.postalCode }}
                            {{ member.address.city }}
                            <template v-if="member.address.country !== currentCountry">
                                <br>{{ formatCountry(member.address.country) }}
                            </template>
                        </dd>
                    </template>
                </dl>
            </div>

            <div v-for="parent in member.parents" :key="'parent-'+parent.id" class="container">
                <hr>
                <h2>{{ ParentTypeHelper.getName(parent.type) }}</h2>

                <dl class="details-grid hover">
                    <dt>Naam</dt>
                    <dd v-copyable>
                        {{ parent.name }}
                    </dd>

                    <template v-if="parent.phone">
                        <dt>GSM-nummer</dt>
                        <dd v-copyable>
                            {{ parent.phone }}
                        </dd>
                    </template>

                    <template v-if="parent.email">
                        <dt>E-mailadres</dt>
                        <dd v-copyable>
                            {{ parent.email }}
                        </dd>
                    </template>

                    <template v-if="parent.address">
                        <dt>Adres</dt>
                        <dd v-copyable>
                            {{ parent.address.street }} {{ parent.address.number }}<br>{{ parent.address.postalCode }}
                            {{ parent.address.city }}
                            <template v-if="parent.address.country !== currentCountry">
                                <br>{{ formatCountry(parent.address.country) }}
                            </template>
                        </dd>
                    </template>
                </dl>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CopyableDirective, FemaleIcon, LongPressDirective, MaleIcon, SegmentedControl, STNavigationBar, STNavigationTitle, TooltipDirective } from "@stamhoofd/components";
import { Country, CountryHelper, MemberSummary, ParentTypeHelper } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        BackButton
    },
    directives: {
        Tooltip: TooltipDirective,
        LongPress: LongPressDirective,
        Copyable: CopyableDirective
    }
})
export default class MemberView extends Mixins(NavigationMixin) {
    @Prop()
    member!: MemberSummary;

    get birthDayFormatted() {
        return this.member.birthDay ? Formatter.date(this.member.birthDay, true) : 'Geen';
    }

    formatCountry(country: Country) {
        return CountryHelper.getName(country)
    }

    get ParentTypeHelper() {
        return ParentTypeHelper
    }
}
</script>