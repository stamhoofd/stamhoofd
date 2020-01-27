<template>
    <div style="padding: 20px;">{{ text }}</div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

@Component({
  props: {
      text: String
  }
})
export default class EditGroup extends Vue {
    
}
</script>