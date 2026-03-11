<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('%Y1') }}
            </h1>

            <p>{{ $t('%Y2') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>

const props = defineProps<{
    location: string;
}>();

window.location.href = props.location;
</script>
