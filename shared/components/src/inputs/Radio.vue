<template>
    <label class="radio">
        <input type="radio" :name="name" :value="value">
        <div>
            <div />
            <div><slot /></div>
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

@Component
export default class Radio extends Vue {
    @Prop({})
    value: any

    @Prop({ default: ""})
    name: string
}
</script>
