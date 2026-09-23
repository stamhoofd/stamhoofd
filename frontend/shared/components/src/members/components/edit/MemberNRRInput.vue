<template>
    <NRNInput v-model="nationalRegisterNumber" :title="$t(`%wK`) + lidSuffix + (!isPropertyRequired('nationalRegisterNumber', true) ? ' ('+$t('%1GF')+')' : '')" :required="isPropertyRequired('nationalRegisterNumber')" :validator="validator" :birth-day="birthDay" data-testid="member-nrn-input">
        <template v-if="!isPropertyEnabled('nationalRegisterNumber')" #right>
            <button class="button icon trash small gray" type="button" @click="nationalRegisterNumber = null" />
        </template>
    </NRNInput>
    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
        <I18nComponent
            :t="$t('Als {firstName} geen Belgische nationaliteit heeft, <button>klik dan hier</button>', {firstName: firstName || $t('%15V')})"
        >
            <template #button="{content}">
                <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                    {{ content }}
                </button>
            </template>
        </I18nComponent>
    </p>
    <p v-else class="style-description-small">
        <I18nComponent
            :t="isNationalRegisterNumberCollectedForTaxCertificates
                ? $t('%15N')
                : $t('Toch een Belgische nationaliteit? <button>Klik dan hier</button>')"
        >
            <template #button="{content}">
                <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                    {{ content }}
                </button>
            </template>
        </I18nComponent>
    </p>
</template>

<script setup lang="ts">
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import type { PlatformMember } from '@stamhoofd/structures';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { computed } from 'vue';
import type { Validator } from '../../../errors/Validator';
import NRNInput from '../../../inputs/NRNInput.vue';
import { useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(defineProps<{
    member: PlatformMember;
    validator: Validator;
}>(), {
});

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const isNationalRegisterNumberCollectedForTaxCertificates = computed(() => {
    return isPropertyEnabled('taxCertificates');
});

const lidSuffix = computed(() => {
    if (firstName.value.length < 2) {
        if (props.member.patchedMember.details.defaultAge < 24) {
            return ' ' + $t(`%105`);
        }
        return '';
    }
    if (props.member.patchedMember.details.defaultAge < 24) {
        return ' ' + $t(`%155`, { name: firstName.value });
    }
    return '';
});

const firstName = computed({
    get: () => props.member.patchedMember.details.firstName,
    set: firstName => props.member.addDetailsPatch({ firstName }),
});

const nationalRegisterNumber = computed({
    get: () => props.member.patchedMember.details.nationalRegisterNumber,
    set: nationalRegisterNumber => props.member.addDetailsPatch({ nationalRegisterNumber }),
});

const birthDay = computed({
    get: () => props.member.patchedMember.details.birthDay,
    set: birthDay => props.member.addDetailsPatch({ birthDay }),
});
</script>
