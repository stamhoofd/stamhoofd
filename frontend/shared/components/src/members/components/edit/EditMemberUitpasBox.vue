<template>
    <div class="container">
        <Title v-bind="$attrs" :title="isAdmin ? $t(`398b3c2b-8c53-48aa-812b-dfaae54157bd`) : $t(`ea393feb-d5dc-4e8f-adc2-2e4bd677ebbc`)"/>
        <p v-if="!isAdmin" class="style-description pre-wrap" v-text="'Heb je een UiTPAS? Vul dan hier het nummer in.'"/>
            
        <STErrorsDefault :error-box="parentErrorBox"/>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <UitpasNumberInput v-model="uitpasNumber" :required="isPropertyRequired('uitpasNumber')" :validator="validator" :title="isAdmin ? undefined : $t(`398b3c2b-8c53-48aa-812b-dfaae54157bd`)"/>

        <p v-if="!willMarkReviewed && isAdmin && reviewDate" class="style-description-small">
            {{ $t('4fdf9809-a752-44a3-b2b4-9fd8dd7f27ff') }} {{ formatDate(reviewDate) }}. <button v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'" type="button" class="inline-link" @click="clear">
                {{ $t('56bcb109-f47d-4f8b-8bd5-59cb085096bc') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import UitpasNumberInput from '../../../inputs/UitpasNumberInput.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null,
    willMarkReviewed?: boolean
}>();

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const errors = useErrors({validator: props.validator});
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));

const uitpasNumber = computed({
    get: () => props.member.patchedMember.details.uitpasNumber,
    set: (uitpasNumber) => {
        props.member.addDetailsPatch({uitpasNumber});
    }
});

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('uitpasNumber');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('uitpasNumber');
    props.member.addDetailsPatch({
        reviewTimes: times
    })
}

</script>
