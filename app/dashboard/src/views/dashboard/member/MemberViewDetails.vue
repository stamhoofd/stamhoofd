<template>
    <div class="member-view-details">
        <div>
            <h2>Algemeen</h2>
            <dl class="details-grid">
                <dt>Verjaardag</dt>
                <dd>{{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)</dd>

                <dt>Lidnummer</dt>
                <dd>{{ member.id }}</dd>

                <dt>Groep</dt>
                <dd>{{ member.groups.map(g => g.settings.name).join(", ") }}</dd>

                <template v-if="member.details.phone">
                    <dt>GSM-nummer</dt>
                    <dd>{{ member.details.phone }}</dd>
                </template>

                <template v-if="member.details.email">
                    <dt>GSM-nummer</dt>
                    <dd>{{ member.details.email }}</dd>
                </template>
            </dl>

            <hr>

            <div v-for="(parent, index) in member.details.parents" :key="index">
                <h2>{{ ParentTypeHelper.getName(parent.type) }}</h2>
                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ parent.name }}</dd>

                    <template v-if="parent.phone">
                        <dt>GSM-nummer</dt>
                        <dd>{{ parent.phone }}</dd>
                    </template>

                    <template v-if="parent.email">
                        <dt>E-mailadres</dt>
                        <dd>{{ parent.email }}</dd>
                    </template>

                    <dt>Adres</dt>
                    <dd>
                        {{ parent.address.street }} {{ parent.address.number }}<br>{{ parent.address.postalCode }}
                        {{ parent.address.city }}
                    </dd>
                </dl>

                <hr>
            </div>

            <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index">
                <h2>{{ contact.title }}</h2>
                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ contact.name }}</dd>

                    <dt>GSM-nummer</dt>
                    <dd>{{ contact.phone }}</dd>
                </dl>

                <hr v-if="index < member.details.emergencyContacts.length - 1">
            </div>

            <template v-if="member.details.doctor">
                <hr>

                <h2>Huisarts</h2>
                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ member.details.doctor.name }}</dd>

                    <dt>Telefoonnummer</dt>
                    <dd>{{ member.details.doctor.phone }}</dd>
                </dl>
            </template>
        </div>

        <div>
            <h2>
                <span class="icon-spacer">Steekkaart</span><span
                    v-tooltip="
                        'De steekkaart kan gevoelige gegevens bevatten. Spring hier uiterst zorgzaam mee om en kijk de privacyvoorwaarden van jouw vereniging na.'
                    "
                    class="icon privacy"
                />
            </h2>

            <ul class="member-records">
                <li
                    v-for="(record, index) in member.details.records"
                    :key="index"
                    class="more"
                    :class="RecordTypeHelper.getPriority(record.type)"
                >
                    {{ record.getText() }}
                </li>
            </ul>

            <hr>

            <h2><span class="icon-spacer">Notities</span><button class="button privacy" /></h2>
            <p>Voeg notities toe voor je medeleiding. Leden of ouders krijgen deze niet te zien.</p>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { TooltipDirective as Tooltip } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";
import { RecordTypeHelper, ParentTypeHelper, DecryptedMember } from '@stamhoofd/structures';

@Component({
    directives: { Tooltip },
})
export default class MemberViewDetails extends Mixins(NavigationMixin) {
    @Prop()
    member!: DecryptedMember;

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
        (this as any).RecordTypeHelper = RecordTypeHelper;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.member-view-details {
    padding: 10px 0;
    padding-bottom: 30px;
    display: grid;
    grid-template-columns: 60% 40%;
    gap: 20px;

    @media (max-width: 700px) {
        grid-template-columns: 100%;
    }

    > div,
    > div > div {
        > h2 {
            @extend .style-title-2;
            margin: 20px 0;
        }

        > p {
            @extend .style-definition-description;
        }

        > hr {
            height: $border-width;
            border: 0;
            outline: 0;
            width: 100%;
            background: $color-gray-lighter;
            border-radius: $border-width/2;
            margin: 30px 0;
        }
    }
}

.details-grid {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 8px 15px;

    dt {
        @extend .style-definition-term;
    }

    dd {
        @extend .style-definition-description;
    }
}

.member-records {
    li {
        list-style: none;
        padding: 11px 15px 8px 40px;
        background: $color-white-shade;
        border-radius: $border-radius;
        margin: 6px 0;
        @extend .style-definition-description;

        &.Low {
            background-image: url(~@stamhoofd/assets/images/icons/gray/info.svg);
            background-position: 10px center;
            background-repeat: no-repeat;
        }

        &.High {
            background: $color-error-background;
            color: $color-error-dark;

            background-image: url(~@stamhoofd/assets/images/icons/color/exclamation-two.svg);
            background-position: 10px center;
            background-repeat: no-repeat;
        }

        &.Medium {
            background: $color-warning-background;
            color: $color-warning-dark;
            background-image: url(~@stamhoofd/assets/images/icons/color/exclamation.svg);
            background-position: 10px center;
            background-repeat: no-repeat;
        }

        &.more {
            cursor: pointer;
            position: relative;
            padding-right: 40px;

            &::after {
                content: "";
                position: absolute;
                right: 10px;
                top: 0;
                bottom: 0;
                width: 24px;
                background-image: url(~@stamhoofd/assets/images/icons/gray/arrow-right-small.svg);
                background-position: left center;
                background-repeat: no-repeat;
                transform: translate(0, 0);
                opacity: 0.5;
                transition: transform 0.2s, opacity 0.2s;
            }

            &.important {
                &::after {
                    background-image: url(~@stamhoofd/assets/images/icons/error-dark/arrow-right-small.svg);
                }
            }

            &.warning {
                &::after {
                    background-image: url(~@stamhoofd/assets/images/icons/warning-dark/arrow-right-small.svg);
                }
            }

            &:hover {
                &::after {
                    transform: translate(5px, 0);
                    opacity: 1;
                }
            }
        }
    }
}
</style>
