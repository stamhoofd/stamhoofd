<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('Doorverwijzen...') }}
            </h1>

            <p>{{ $t('Bezig met doorverwijzen') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>

const props = defineProps<{
    location: string;
}>();

window.location.href = props.location;
</script>
