<template>
    <div class="radio-group">
        <slot></slot>
    </div>
</template>


<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class RadioGroup extends Vue {
   

}
</script>

<style lang="scss">
    @use '~@shared/scss/components/inputs.scss';

    .radio-group {
        display: flex;
        flex-wrap: wrap;
        margin: 10px 0;

        + label.style-label  {
            margin-top: 20px;
        }
        
        .radio {
            flex-shrink: 0;
            margin-right: 20px;
        }
    }
</style>