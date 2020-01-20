<template>
    <div class="gender-selector">
        <label>
            <input type="checkbox" name="male" class="male">
            <div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18C12.2091 18 14 16.2091 14 14C14 11.7909 12.2091 10 10 10C7.79086 10 6 11.7909 6 14C6 16.2091 7.79086 18 10 18Z" stroke="#0053FF" stroke-width="2"/>
                    <path d="M13 11L17 7" stroke="#0053FF" stroke-width="2"/>
                    <path d="M18 10V6H14" stroke="#0053FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        </label>
        <label>
            <input type="checkbox" name="female" class="female">
            <div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="#FF0089" stroke-width="2"/>
                    <path d="M12 12V19" stroke="#FF0089" stroke-width="2" stroke-linecap="round"/>
                    <path d="M9 16H15" stroke="#FF0089" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
        </label>
    </div>
</template>


<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class GenderSelector extends Vue {
   

}
</script>

<style lang="scss">
    .gender-selector {
        display: inline-flex;
        vertical-align: middle;

        label input {
            display: none;
        } 
        input + div {
            display: block;
            width: 24px;
            height: 24px;
            background: url(~@shared/assets/images/icons/border/male.svg) center center no-repeat;
            transition: background-image 0.2;
            cursor: pointer;

            svg > path {
                stroke-dasharray: 30;
                stroke-dashoffset: 30;
                transition: stroke-dashoffset 0.4s 0.1s;
            }

            @media (pointer: coarse) {
                padding: 0 5px;
            }
        }
        input.female + div {
            background-image: url(~@shared/assets/images/icons/border/female.svg);
        }

        label:active {
            opacity: 0.5;
        }

        input:checked + div {
            display: block;
            width: 24px;
            height: 24px;
            cursor: pointer;

            svg > path {
                stroke-dashoffset: 0;
            }
        }
        input.female:checked + div {
        }
    }
</style>