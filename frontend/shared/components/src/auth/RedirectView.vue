<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                {{ $t('12d2a8ca-d23d-4238-ba3d-86cd31a48067') }}
            </h1>

            <p>{{ $t('a0b2d272-5bcf-4ecb-9bb1-f2ba239b6c03') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>

const props = defineProps<{
    location: string;
}>();

window.location.href = props.location;
</script>
