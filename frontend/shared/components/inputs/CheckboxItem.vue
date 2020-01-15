<template>
    <label class="checkbox item">
        <input type="checkbox" name="gender" value="mixed">
        <div>
            <div>
                <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4L4 8L9 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="group">
                <div><slot name="left"></slot></div>
                <div><slot name="right"></slot></div>
            </div>
            
        </div>
    </label>
</template>


<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class CheckboxItem extends Vue {
   

}
</script>

<style lang="scss">
    @use '~@shared/scss/base/variables.scss' as *;
    @use "~@shared/scss/components/checkbox.scss";

    .checkbox.item {
        padding: 10px 0;

        &+ .checkbox.item {
            border-bottom: $border-width solid $color-gray-lighter;
        }
        .group {
            flex-grow: 1;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
    
    }
</style>