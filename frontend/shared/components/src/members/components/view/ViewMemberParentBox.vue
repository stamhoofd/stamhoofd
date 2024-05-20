<template>
    <div class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>Naam</dt>
            <dd v-copyable>
                {{ parent.name }}
            </dd>

            <template v-if="parent.phone">
                <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
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
</template>

<script setup lang="ts">
import { Parent, PlatformMember, ParentTypeHelper } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    parent: Parent,
    member: PlatformMember
}>()

const currentCountry = useCountry();

</script>
