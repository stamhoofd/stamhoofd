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
                <div>
                    <div><slot name="left"></slot></div>
                    <div><slot name="right"></slot></div>
                </div>
                <div><slot name="buttons"></slot></div>
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
    @use '~scss/base/variables.scss' as *;
    @use "~scss/components/checkbox.scss";

    .checkbox.item {
        margin: 0;
        
        &+ .checkbox.item .group {
            border-top: $border-width solid $color-gray-light;
        }
        .group {
            
            flex-grow: 1;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            
            // Min width to fix overflow
            min-width: 0;

            &> div:first-child {
                padding: 15px 0;
                padding-right: 10px;
                flex-grow: 1;
                flex-basis: 0;
                flex-shrink: 100;

                // Min width to fix ellipsis
                min-width: 0;
                
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;

                @media (max-width: 400px) {
                    flex-direction: column;
                    align-items: stretch;
                    flex-shrink: 100;
                }

                &> div {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                &> div:first-child {
                    flex-grow: 1;
                    padding-right: 10px;
                } 

                &>div:last-child {
                    color: $color-gray;
                }
            }

            &>div:last-child {
                flex-shrink: 0;
                display: flex;
                justify-content: flex-end;
                align-items: center;

                > *:last-child {
                    margin-right: 0 !important;
                }
            }
        }
    
    }
</style>