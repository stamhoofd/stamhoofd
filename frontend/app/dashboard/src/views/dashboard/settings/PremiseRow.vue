<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ title }}
        </h2>
        <p class="style-description-small">
            {{ premiseString }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { useCountry, usePlatform } from '@stamhoofd/components';
import { CountryHelper, Premise } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    premise: Premise
}>();

const currentCountry = useCountry();
const platform = usePlatform();

const premiseTypes = computed(() => platform.value.config.premiseTypes ?? [])

const title = computed(() => {
    const premiseTypeIds = props.premise.premiseTypeIds;

    if(!premiseTypeIds.length) return 'Gebouw';

    const typeNames = premiseTypeIds.map(premiseTypeId => {
        const premiseType = premiseTypes.value.find(t => t.id === premiseTypeId);
        if(!premiseType) return 'Onbekend';
        return premiseType.name;
    });

    if(typeNames.length === 1) return typeNames[0];

    const firstTypes = typeNames.slice(0, typeNames.length - 1).join(', ');

    return `${firstTypes} & ${typeNames[typeNames.length - 1]}`
});

const premiseString = computed(() => {
    const address = props.premise.address;
    const base = `${address.street} ${address.number}, ${address.postalCode} ${address.city}`;
    if(currentCountry.value !== address.country) {
        return `${base}, ${CountryHelper.getName(address.country)}`;
    }

    return base;
})
</script>
