<template>
    <div class="member-view-details">
        <div>
            <h2>Algemeen</h2>
            <dl class="details-grid">
                <dt>Verjaardag</dt>
                <dd>{{ member.birthDayFormatted }} ({{ member.age }} jaar)</dd>

                <dt>Lidnummer</dt>
                <dd>12598711546216</dd>

                <dt>Groep</dt>
                <dd>Kapoenen</dd>
            </dl>

            <hr />

            <div v-for="(parent, index) in member.parents" :key="index">
                <h2>{{ ParentTypeHelper.getName(parent.type) }}</h2>
                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ parent.name }}</dd>

                    <dt>GSM-nummer</dt>
                    <dd>+32 456 76 32 22</dd>

                    <dt>E-mailadres</dt>
                    <dd>linda.de.grootte@gmail.com</dd>

                    <dt>Adres</dt>
                    <dd>
                        {{ parent.address.street }} {{ parent.address.number }}<br />{{ parent.address.postalCode }}
                        {{ parent.address.city }}
                    </dd>
                </dl>

                <hr />
            </div>

            <h2>Oma</h2>
            <dl class="details-grid">
                <dt>Naam</dt>
                <dd>Linda De Grootte</dd>

                <dt>GSM-nummer</dt>
                <dd>+32 456 76 32 22</dd>

                <dt>E-mailadres</dt>
                <dd>linda.de.grootte@gmail.com</dd>

                <dt>Adres</dt>
                <dd>Tulplaan 435<br />9000 Gent</dd>
            </dl>
        </div>

        <div>
            <h2>
                <span class="icon-spacer">Steekkaart</span
                ><button
                    class="button privacy tooltip-only"
                    v-tooltip="
                        'De steekkaart kan gevoelige gegevens bevatten. Spring hier uiterst zorgzaam mee om en kijk de privacyvoorwaarden van jouw vereniging na.'
                    "
                />
            </h2>

            <ul class="member-records">
                <li class="important more">Gezin met financiële moeilijkheden</li>
                <li class="important">Geen medicatie toedienen</li>
                <li class="important more">Geen foto’s maken</li>
                <li class="warning">Kan niet zwemmen</li>
                <li class="warning more">Geneesmiddelen nemen</li>
                <li class="warning">Bedwateren</li>
                <li class="warning">Hartkwaal</li>
                <li class="warning more">Allergisch voor noten</li>
                <li class="warning">Allergisch voor verf</li>
                <li class="warning">Niet ingeënt tegen tetanus</li>
                <li class="info more">Vegetarisch</li>
                <li class="info">Tetanus inenting in 2009</li>
            </ul>

            <hr />

            <h2><span class="icon-spacer">Notities</span><button class="button privacy" /></h2>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";
import Tooltip from "shared/directives/Tooltip";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import { Member } from "shared/models/Member";
import { ParentType, ParentTypeHelper } from "shared/models/ParentType";

@Component({
    directives: { Tooltip }
})
export default class MemberViewDetails extends Mixins(NavigationMixin) {
    @Prop()
    member!: Member;

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
    }
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.member-view-details {
    padding: 10px 0;
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

        > hr {
            height: $border-width;
            border: 0;
            outline: 0;
            width: 100%;
            background: $color-gray-lighter;
            border-radius: $border-width/2;
            margin: 20px 0;
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

        &.info {
            background-image: url(~assets/images/icons/gray/info.svg);
            background-position: 10px center;
            background-repeat: no-repeat;
        }

        &.important {
            background: $color-error-background;
            color: $color-error-dark;

            background-image: url(~assets/images/icons/color/exclamation-two.svg);
            background-position: 10px center;
            background-repeat: no-repeat;
        }

        &.warning {
            background: $color-warning-background;
            color: $color-warning-dark;
            background-image: url(~assets/images/icons/color/exclamation.svg);
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
                background-image: url(~assets/images/icons/gray/arrow-right-small.svg);
                background-position: left center;
                background-repeat: no-repeat;
                transform: translate(0, 0);
                opacity: 0.5;
                transition: transform 0.2s, opacity 0.2s;
            }

            &.important {
                &::after {
                    background-image: url(~assets/images/icons/error-dark/arrow-right-small.svg);
                }
            }

            &.warning {
                &::after {
                    background-image: url(~assets/images/icons/warning-dark/arrow-right-small.svg);
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
