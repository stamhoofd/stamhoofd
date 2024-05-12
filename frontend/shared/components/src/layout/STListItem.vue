<template>
    <component
        :is="dynamicElementName"
        class="st-list-item"
        :class="{
            selectable,
            hoverable,
            disabled,
            button: dynamicElementName === 'button',
        }"
        :type="dynamicElementName === 'button' ? 'button' : undefined"
        @click="onClick"
        @contextmenu="$emit('contextmenu', $event)"
    >
        <div class="left">
            <slot name="left" />
        </div>
        <div class="main">
            <div>
                <div class="middle">
                    <slot />
                </div>
                <div class="right">
                    <slot name="right" />
                </div>
            </div>
            <hr>
        </div>
    </component>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({
    emits: ["click"],
})
export default class STListItem extends Vue {
    @Prop({ default: "article", type: String })
        elementName!: string;

    @Prop({ default: false, type: Boolean })
        selectable!: boolean;

    @Prop({ default: false, type: Boolean })
        disabled!: boolean;

    get dynamicElementName() {
        if (this.elementName === "article" && this.selectable && !this.disabled) {
            return "button";
        }
        return this.elementName;
    }

    get hoverable() {
        return this.elementName === "button";
    }

    onClick(event) {
        const isDragging =
      this.$parent?.$parent?.$el.className.indexOf("is-dragging") !== -1;
        if (isDragging) {
            console.log("canceled list item click because of drag");
            return;
        }
        this.$emit("click", event);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;

.st-list-description {
  @extend .style-description;
  padding: 5px 0;
}

a.st-list-item {
  &,
  &:hover,
  &:active,
  &:visited,
  &:link {
    color: inherit;
    text-decoration: inherit;
  }
}

button.st-list-item {
  text-align: inherit;
}

.st-list-item {
  padding-left: var(--st-horizontal-padding, 15px);
  padding-right: 0;
  padding-right: var(--st-horizontal-padding, 15px);

  margin: 0;
  display: flex !important;
  flex-direction: row;
  width: 100%; // fix for buttons
  box-sizing: border-box;
  contain: style paint;

  @extend .style-normal;

  &.selected {
    color: $color-primary;
  }

  > .left {
    flex-shrink: 0;

    padding-top: var(--st-list-padding, 15px);
    padding-right: 15px;
    padding-bottom: var(--st-list-padding, 15px);
    min-width: 0; // flexbox disable becoming bigger than parent

    &:empty {
      display: none;
    }
  }

  &.left-center {
    > .left {
      display: flex;
      flex-direction: row;
      align-items: center;
    }
  }

  &.right-small {
    > .main > div > .right {
      @extend .style-description-small;
      text-align: right;
      padding-left: 10px;
    }
  }

  &.right-description {
    > .main > div > .right {
      @extend .style-description;
      text-align: right;
      flex-shrink: 10;
      padding-left: 15px;
    }
  }

  &.right-price {
    > .main > div > .right {
      @extend .style-description;
      text-align: right;
      flex-shrink: 0;
      padding-left: 15px;
    }
  }

  &.right-description.wrap {
    > .main > div > .right {
      white-space: pre-wrap;
    }
  }

  &.right-stack {
    .right {
      display: flex;
      flex-direction: row;
      align-items: center;
      > * {
        margin: 0 5px;

        &:last-child {
          margin-right: 0;
        }

        &:first-child {
          margin-left: 0;
        }
      }

      > .button {
        margin: -5px 5px;

        &:last-child {
          margin-right: 0;
        }

        &:first-child {
          margin-left: 0;
        }
      }
    }

    &.no-margin {
      .right {
        > * {
          margin: 0;
        }

        > .button {
          margin: -5px 0;
        }
      }
    }
  }

  &.no-padding {
    > .main > div > .middle {
      padding: 0 !important;
    }

    > .main > div > .right {
      padding: 0 !important;
    }
  }

  > .main {
    flex-grow: 1;

    // Make sure the hr drops to the bottom if the left is longer
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0; // flexbox disable becoming bigger than parent

    > div {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-grow: 1;

      > .middle {
        padding-top: var(--st-list-padding, 15px);
        padding-bottom: var(--st-list-padding, 15px);
        flex-grow: 1;
        min-width: 0; // flexbox disable becoming bigger than parent
      }

      > .right {
        margin-left: auto;
        min-width: 0; // flexbox disable becoming bigger than parent
        flex-shrink: 0;

        padding-top: var(--st-list-padding-right, var(--st-list-padding, 10px));
        padding-bottom: var(
          --st-list-padding-right,
          var(--st-list-padding, 10px)
        );
        padding-left: 15px;

        &:empty {
          display: none;
        }
      }
    }

    > hr {
      border: 0;
      outline: 0;
      height: $border-width-thin;
      width: 100%;
      background: $color-border;
      border-radius: $border-width-thin/2;
      margin: 0;
      margin-right: calc(-1 * var(--st-horizontal-padding, 15px));

      // Increase width + horizontal padding
      padding-right: var(--st-horizontal-padding, 15px);
    }
  }

  // Wrap on smartphones (because content is too long)
  &.smartphone-wrap {
    @media (max-width: 450px) {
      > .main > div {
        display: block;

        > .middle {
          padding-right: var(--st-horizontal-padding, 15px);
          padding-bottom: 0px;
        }

        > .right {
          padding-top: 5px;
          padding-bottom: 15px;
        }
      }
    }
  }

  &:last-child,
  &.no-border {
    > .main > hr {
      display: none;
    }
  }

  &.disabled {
    opacity: 0.5;
  }

  &.selectable:not(.is-dragging) {
    touch-action: manipulation;
    user-select: none;
    transition: background-color 0.2s 0.1s;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    cursor: pointer;

    > .main {
      > hr {
        transition: opacity 0.2s 0.1s;
      }
    }

    &.hoverable:hover {
      opacity: 0.6;

      &:has(button:hover) {
        opacity: 1;
      }
    }

    &:active {
      transition: none;
      background: $color-background-shade;
      background: var(
        --color-current-background-shade,
        $color-background-shade
      );

      > .main {
        > hr {
          transition: none;
          opacity: 0;
        }
      }
    }

    &:active:has(button:active) {
      transition: background-color 0.2s 0.1s;
      background: none;

      > .main {
        > hr {
          opacity: 1;
          transition: opacity 0.2s 0.1s;
        }
      }
    }
  }

  &.sortable-chosen {
    transition: none;
    background: $color-background-shade;
    background: var(--color-current-background-shade, $color-background-shade);
  }

  &.sortable-chosen.is-dragging {
    touch-action: manipulation;
    user-select: none;
    transition: background-color 0.2s 0.1s;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    cursor: pointer;

    transition: none;
    background: none;
  }
}
</style>
