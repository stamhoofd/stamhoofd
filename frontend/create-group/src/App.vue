<template>
  <div id="app">
    <header>
        <h1>Jouw vereniging aansluiten</h1>
    </header>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import HelloWorld from './components/HelloWorld.vue';

@Component({
  components: {
    HelloWorld,
  },
})
export default class App extends Vue {}
</script>

<style lang="scss">
@import "~@shared/scss/fonts.scss";

#app {
  font-family: 'Metropolis', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: $dark-color;
  margin-top: 60px;
}
</style>
