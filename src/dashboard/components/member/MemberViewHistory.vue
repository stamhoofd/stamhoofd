<template>
    <div class="root">
        <p v-for="n in 100" :key="n">History</p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

@Component({})
export default class MemberViewHistory extends Vue {}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
</style>
