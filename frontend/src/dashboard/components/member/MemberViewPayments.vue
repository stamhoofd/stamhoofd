<template>
    <div class="root">
        <p v-for="n in 100" :key="n">Payments</p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

@Component({})
export default class MemberViewPayments extends Vue {}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
</style>
