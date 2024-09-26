<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ name ? name : addressString }}
        </h2>

        <p v-if="name" class="style-description-small">
            {{ addressString }}
        </p>
        <p class="style-description-small">
            {{ premiseTypesString }}
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
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = defineProps<{
    premise: Premise;
}>();

const currentCountry = useCountry();
const platform = usePlatform();

const name = computed(() => props.premise.name);

const platformPremiseTypes = computed(() => platform.value.config.premiseTypes ?? []);

const premiseTypesString = computed(() => {
    const premiseTypeIds = props.premise.premiseTypeIds;

    if (!premiseTypeIds.length) return 'Lokaal';

    const allTypes = platformPremiseTypes.value;

    const typeNames = Array.from(
        // remove duplicates (for example 'Onbekend')
        new Set(premiseTypeIds
            .map(id => allTypes.findIndex(t => t.id === id))
            // sort in same order as platform premise types
            .sort()
            .map((i) => {
                if (i === -1) return 'Onbekend';
                const name = allTypes[i].name;
                return name;
            }),
        ),
    );

    if (typeNames.length === 1) return typeNames[0];
    return Formatter.joinLast(typeNames, ', ', ' en ');
});

const addressString = computed(() => {
    const address = props.premise.address;
    const base = `${address.street} ${address.number}, ${address.postalCode} ${address.city}`;
    if (currentCountry.value !== address.country) {
        return `${base}, ${CountryHelper.getName(address.country)}`;
    }

    return base;
});
</script>
