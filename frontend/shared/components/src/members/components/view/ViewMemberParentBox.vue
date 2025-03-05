<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>{{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}</dt>
            <dd v-copyable>
                {{ parent.name }}
            </dd>

            <template v-if="parent.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd v-copyable>
                    {{ parent.phone }}
                </dd>
            </template>

            <template v-if="parent.email">
                <dt>{{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }} {{ parent.alternativeEmails.length ? '1' : '' }}</dt>
                <dd v-copyable>
                    {{ parent.email }}
                </dd>
            </template>

            <template v-for="(email, index) of parent.alternativeEmails" :key="index">
                <dt>{{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }} {{ index + 2 }}</dt>
                <dd v-copyable>
                    {{ email }}
                </dd>
            </template>

            <template v-if="parent.address">
                <dt>{{ $t('e6dc987c-457b-4253-9eef-db9ccdb774f1') }}</dt>
                <dd v-copyable>
                    {{ parent.address.street }} {{ parent.address.number }}<br><template v-if="parent.address.country !== currentCountry">
                        <br></template>
                </dd>
            </template>

            <template v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('642e4034-71e5-4d00-a6f4-b7dbcc39aac0') }}</dt>
                <dd v-copyable>
                    {{ parent.nationalRegisterNumber }}
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { Parent, PlatformMember, ParentTypeHelper, NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    parent: Parent;
    member: PlatformMember;
}>();

const currentCountry = useCountry();

</script>
