<template>
    <div class="container">
        <Title v-bind="$attrs" :title="isAdmin ? 'UiTPAS-nummer' : 'UiTPAS'" />
        <p v-if="!isAdmin" class="style-description pre-wrap" v-text="'Heb je een UiTPAS? Vul dan hier het nummer in.'" />
            
        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <UitpasNumberInput
            v-model="uitpasNumber"
            :required="isPropertyRequired('uitpasNumber')"
            :validator="validator"
            :title="isAdmin ? undefined : 'UiTPAS-nummer'"
        />

        <p v-if="!willMarkReviewed && isAdmin && reviewDate" class="style-description-small">
            Laatst gewijzigd op {{ formatDate(reviewDate) }}. <button v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'" type="button" class="inline-link" @click="clear">
                Wissen
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
