<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <p>{{ type.description }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />


            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>Onvolledig (klad)</span>
                        <span class="icon clock" />
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText">
                    <h3 class="style-definition-label">
                        Opmerkingen
                    </h3>
                    <p class="style-definition-text">
                        {{ notification.feedbackText }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { EventNotification } from '@stamhoofd/structures';
import { useErrors } from '../errors/useErrors';
import { usePlatform } from '../hooks';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        isNew: boolean;
        notification: EventNotification;
    }>(),
    {
    },
);

const errors = useErrors(); ;
const platform = usePlatform();
const type = computed(() => platform.value.config.eventNotificationTypes.find(t => t.id === props.notification.typeId)!);

const title = computed(() => {
    return type.value?.title || 'Notificatie';
});

</script>
