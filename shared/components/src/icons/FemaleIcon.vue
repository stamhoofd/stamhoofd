<template>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <path
            d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
            stroke="#FF0089"
            stroke-width="2"
        />
        <path d="M12 12V19" stroke="#FF0089" stroke-width="2" stroke-linecap="round" />
        <path d="M9 16H15" stroke="#FF0089" stroke-width="2" stroke-linecap="round" />
    </svg>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class FemaleIcon extends Vue {}
</script>