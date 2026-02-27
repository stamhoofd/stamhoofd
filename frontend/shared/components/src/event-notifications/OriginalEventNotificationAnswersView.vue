<template>
    <div class="st-view">
        <STNavigationBar :title="$t('21127e91-a406-4a40-b9a7-af4e45c1f907')" />

        <main>
            <h1>
                {{ $t('21127e91-a406-4a40-b9a7-af4e45c1f907') }}
            </h1>
            <p>{{ $t('3a851e65-6c43-433f-a7af-808ea01f271e') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '#errors/useErrors';
import { EventNotificationViewModel } from './classes/EventNotificationViewModel';

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
