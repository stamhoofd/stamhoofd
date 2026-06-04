<template>
    <div class="st-view onboarding-start-view shade" data-testid="onboarding-start-view">
        <STNavigationBar :title="$t('Welkom bij Stamhoofd')" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ $t('Welkom bij Stamhoofd') }}
            </h1>
            <p class="style-description-block">
                {{ $t('Waarmee wil je starten? Je kan dit later altijd uitbreiden.') }}
            </p>

            <div class="onboarding-options">
                <button type="button" class="onboarding-option" @click="startMemberAdministration">
                    <figure>
                        <IconContainer icon="team" class="secundary" />
                    </figure>
                    <h2>{{ $t('Onze leden beheren') }}</h2>
                    <p class="style-description">
                        {{ $t('Ledenportaal, inschrijvingen, kalender en lidgeld op één plek.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Voor clubs met vaste leden') }}
                    </p>
                </button>

                <button type="button" class="onboarding-option" @click="startSelling">
                    <figure>
                        <IconContainer icon="basket" class="success" />
                    </figure>
                    <h2>{{ $t('Iets verkopen of verzamelen') }}</h2>
                    <p class="style-description">
                        {{ $t('Tickets, webshop, inschrijvingen of een gift.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Voor evenementen of een actie') }}
                    </p>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { useMemberAdministrationOnboarding } from './useMemberAdministrationOnboarding';
import { Toast } from '@stamhoofd/components';

const startMemberAdministrationOnboarding = useMemberAdministrationOnboarding();

async function startMemberAdministration() {
    await startMemberAdministrationOnboarding();
}

function startSelling() {
    // TODO: implement the "selling or collecting" onboarding flow.
    Toast.warning('WIP. Not implemented yet.').show();
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.onboarding-start-view {
    .onboarding-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-top: 20px;

        @media (max-width: 550px) {
            grid-template-columns: 1fr;
        }
    }

    h1, main > p {
        text-align: center;
    }

    .onboarding-option {
        --block-width: 40px;

        display: block;
        text-align: left;
        padding: 20px;
        border-radius: $border-radius;
        background: $color-background;
        cursor: pointer;
        transition: background-color 0.2s;
        border: $border-width solid $color-border;
        @extend .style-input-shadow;

        &:hover {
            background: $color-background-shade;
        }

        &:active, &.active {
            background: $color-background-shade-darker;
        }

        figure {
            margin-bottom: 10px;

            img {
                width: 60px;
                height: 60px;
            }
        }

        h2 {
            @extend .style-title-2;
            padding-bottom: 5px;
        }

        p:last-child {
            padding-top: 10px;
            margin-top: auto;
            font-style: italic;
        }
    }
}
</style>
