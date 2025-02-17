<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                Doorverwijzen...
            </h1>

            <p>Bezig met doorverwijzen naar</p>
        </main>
    </div>
</template>

<script lang="ts" setup>

const props = defineProps<{
    location: string;
}>();

window.location.href = props.location;
</script>
