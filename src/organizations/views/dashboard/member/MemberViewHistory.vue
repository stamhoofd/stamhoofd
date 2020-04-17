<template>
    <div class="root">
        <p v-for="n in 100" :key="n">
            History
        </p>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component({})
export default class MemberViewHistory extends Vue {}
</script>

<style scoped lang="scss">
</style>
