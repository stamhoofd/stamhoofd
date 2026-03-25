<template>
    <div class="st-view">
        <STNavigationBar :title="$t('%Cd')" />

        <main>
            <h1>
                {{ $t('%Cd') }}
            </h1>
            <p>{{ $t('%Ce') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification" />
        </main>
    </div>
</template>

<script setup lang="ts">
import ViewRecordCategoryAnswersBox from '#records/components/ViewRecordCategoryAnswersBox.vue';
import { RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '#errors/useErrors.ts';
import type { EventNotificationViewModel } from './classes/EventNotificationViewModel';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
    }>(), {

    },
);

const notification = props.viewModel.useOriginalNotification();
const errors = useErrors(); ;
const type = props.viewModel.useType();

const recordCategories = computed(() => {
    return RecordCategory.filterCategories(type.value.recordCategories, notification.value);
});

</script>
