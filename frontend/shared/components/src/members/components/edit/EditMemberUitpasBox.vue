<template>
    <div class="container">
        <Title v-bind="$attrs" :title="isAdmin ? $t(`%wF`) : $t(`%14`)" />
        <p v-if="!isAdmin" class="style-description pre-wrap" v-text="$t('%fX')" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <UitpasNumberInputWithStatus v-model="uitpasNumberDetails" :required="isPropertyRequired('uitpasNumber')" :validator="validator" :title="isAdmin ? undefined : $t(`%wF`)" error-fields="uitpasNumber" />

        <p v-if="!willMarkReviewed && isAdmin && reviewDate" class="style-description-small">
            {{ $t('%fY') }} {{ formatDate(reviewDate) }}. <button :v-tooltip="$t('%fD')" type="button" class="inline-link" @click="clear">
                {{ $t('%fE') }}
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
import UitpasNumberInputWithStatus from '../../../inputs/UitpasNumberInputWithStatus.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>();

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const errors = useErrors({ validator: props.validator });
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));

const uitpasNumberDetails = computed({
    get: () => props.member.patchedMember.details.uitpasNumberDetails,
    set: (details) => {
        props.member.addDetailsPatch({ uitpasNumberDetails: details });
    },
});

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('uitpasNumber');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('uitpasNumber');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

</script>
