<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('024b0957-571c-40c3-954e-a251bd0b257f') }}
            </h1>

            <p>{{ $t('49ee57ef-966d-4496-9e50-2e906788e3fd') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>

const props = defineProps<{
    location: string;
}>();

window.location.href = props.location;
</script>
