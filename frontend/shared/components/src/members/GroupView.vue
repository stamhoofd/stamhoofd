<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name" />
        
        <main>
            <h1>
                <span>{{ group.settings.name }}</span>
                <!--<GroupTag :group="group" />-->
            </h1>
            <figure v-if="group.settings.coverPhoto" class="cover-photo">
                <ImageComponent :image="group.settings.coverPhoto" :auto-height="true" />
            </figure>

            <p v-if="group.settings.description" class="style-description pre-wrap" v-text="group.settings.description" />

            <p v-if="validationError" class="warning-box">
                {{ validationError }}
            </p>

            <p v-if="infoDescription" class="info-box">
                {{ infoDescription }}
            </p>

            <STList class="group-info-list">
                <STListItem class="right-description">
                    Wanneer?

                    <template v-if="group.settings.displayStartEndTime" #right>
                        {{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}
                    </template>
                    <template v-else #right>
                        {{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}
                    </template>
                </STListItem>
                <STListItem v-if="group.settings.location" class="right-description">
                    Waar?

                    <template #right>
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem class="right-description wrap">
                    Wie?

                    <template #right>
                        <div v-text="who" />
                    </template>
                </STListItem>

                <STListItem v-for="(price, index) of priceList" :key="index">
                    <h3>{{ price.text }}</h3>
                    <p class="style-description-small">
                        {{ price.description }}
                    </p>

                    <template #right>
                        <div class="style-description" v-text="price.price" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="!validationError && member">
            <template #right>
                <button class="primary button" type="button" @click="registerMember">
                    <span>{{ member.patchedMember.firstName }} inschrijven</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ImageComponent, STToolbar } from '@stamhoofd/components';
import { Group, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = defineProps<{
    group: Group,
    member: PlatformMember
}>();
const registerItem = computed(() => RegisterItem.defaultFor(props.member, props.group))
const validationError = computed(() => registerItem.value.validationError )
const infoDescription = computed(() => validationError.value ? null : registerItem.value.infoDescription);

function registerMember() {
    // todo
}

const priceList = computed(() => {
    const prices = props.group.settings.getGroupPrices(new Date())
    if (!prices) {
        return []
    }

    const list: { text: string, description: string, price: string }[] = []

    for (const [index, price] of prices.prices.entries()) {
        list.push({
            text: "Prijs",
            description: prices.prices.length > 1 ? (prices.sameMemberOnlyDiscount ? Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(index + 1)+" inschrijving") : Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(index + 1)+" gezinslid")): "",
            price: Formatter.price(price.price),
        })
    }

    for (const [index, price] of prices.prices.entries()) {
        if (price.reducedPrice !== null && price.reducedPrice !== price.price) {
            const text = prices.prices.length > 1 ? (prices.sameMemberOnlyDiscount ? Formatter.capitalizeFirstLetter("Verlaagd tarief voor "+Formatter.ordinalNumber(index + 1)+" inschrijving") : Formatter.capitalizeFirstLetter("Verlaagd tarief voor "+Formatter.ordinalNumber(index + 1)+" gezinslid")): "Verlaagd tarief"
            list.push({
                text,
                description: "Enkel voor gezinnen die in aanmerking komen voor financiële ondersteuning",
                price: Formatter.price(price.reducedPrice),
            })
        }
    }

    return list
});

const who = computed(() => {
    let who = props.group.settings.getAgeGenderDescription({includeAge: true, includeGender: true}) ?? '';

    if (props.group.settings.requireGroupIds.length > 0 || props.group.settings.preventPreviousGroupIds.length > 0 || props.group.settings.requirePreviousGroupIds.length > 0) {
        const prefix = 'Afhankelijk van andere inschrijvingen'
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
})

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
    .cover-photo > .image-component {
        position: relative;
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-bottom: 20px;
    }
}
</style>
