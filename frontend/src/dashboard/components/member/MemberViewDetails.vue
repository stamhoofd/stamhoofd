<template>
    <div class="member-view-details">
        <div>
            <h2>Algemeen</h2>
            <dl class="details-grid">
                <dt>Verjaardag</dt>
                <dd>16 september 2006 (12 jaar)</dd>

                <dt>Lidnummer</dt>
                <dd>12598711546216</dd>

                <dt>Groep</dt>
                <dd>Kapoenen</dd>
            </dl>

            <hr />

            <h2>Mama</h2>
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

            <hr />

            <h2>Mama</h2>
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

            <hr />

            <h2>Mama</h2>
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
            <h2>Steekkaart</h2>

            <ul class="member-records">
                <li class="important">Gezin met financiële moeilijkheden</li>
                <li class="important">Geen medicatie toedienen</li>
                <li class="important">Geen foto’s maken</li>
                <li class="warning">Kan niet zwemmen</li>
                <li class="warning">Geneesmiddelen nemen</li>
                <li class="warning">Bedwateren</li>
                <li class="warning">Hartkwaal</li>
                <li class="warning">Allergisch voor noten</li>
                <li class="warning">Allergisch voor verf</li>
                <li class="warning">Niet ingeënt tegen tetanus</li>
                <li class="info">Vegetarisch</li>
                <li class="info">Tetanus inenting in 2009</li>
            </ul>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

@Component({})
export default class MemberViewDetails extends Vue {}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.member-view-details {
    padding: 10px 0;
    display: grid;
    grid-template-columns: 60% 40%;
    gap: 15px;

    @media (max-width: 700px) {
        grid-template-columns: 100%;
    }

    > div {
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
    }
}
</style>
