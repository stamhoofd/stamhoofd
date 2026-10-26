<template>
    <div ref="root" class="preview-panel" :class="{ wide: isWide() }">
        <div class="preview-panel-view">
            <slot :wide="isWide()" />
        </div>
        <aside v-show="isWide()" ref="aside" class="preview-panel-column">
            <div ref="column" />

            <!-- Only in the column: on small screens the view keeps its own buttons -->
            <div v-if="isWide() && $slots.actions" class="preview-panel-actions">
                <slot name="actions" />
            </div>
        </aside>

        <!-- The preview stays mounted while it moves between the column and the outlet of the view -->
        <div class="preview-panel-parking">
            <Teleport v-if="$slots.preview" :to="target ?? 'body'" :disabled="!target">
                <div class="preview-panel-preview">
                    <slot name="preview" />
                </div>
            </Teleport>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useElementSize } from '#hooks/useElementSize.ts';
import { computed, useTemplateRef } from 'vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';
import { providePreviewPanel, useReportPreviewColumnWidth } from './usePreviewPanel';

const slots = defineSlots<{
    /**
     * The view. `wide` is true while the preview is shown in its own column, e.g. to move the buttons of the view to the actions slot.
     */
    default?: (props: { wide: boolean }) => any;
    /**
     * Leave it out (e.g. with v-if) to show the view on its own
     */
    preview?: () => any;
    /**
     * Shown below the preview, only while the preview has its own column
     */
    actions?: () => any;
}>();

// Below this width the preview moves into the scroll area of the view (see PreviewOutlet)
const minWideWidth = 900;

const root = useTemplateRef<HTMLElement>('root');
const column = useTemplateRef<HTMLElement>('column');
// Also available to the parent with v-model:wide, e.g. to show something else when the preview does not fit next to the view
const wide = defineModel<boolean>('wide', { default: false });

useResizeObserver(root, (entry) => {
    wide.value = (entry?.contentRect.width ?? 0) >= minWideWidth;
});

// A function instead of a computed: slots are not reactive, but the template renders again when they change
function isWide() {
    return wide.value && !!slots.preview;
}

const { outlet } = providePreviewPanel();

// Hidden (so 0) while the preview has no column
const { width: columnWidth } = useElementSize(useTemplateRef<HTMLElement>('aside'));
useReportPreviewColumnWidth(columnWidth);
const target = computed(() => wide.value ? column.value : outlet.value);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.preview-panel-preview {
    // Same text styles as the main of a view, also when the preview is shown in its own column
    @extend %main-text-container;
}

.preview-panel {
    &.wide {
        display: grid;
        // Padding of the view at the edge of the screen (resolved here, views set their own horizontal padding to 0 when centered)
        --preview-panel-view-padding: var(--st-horizontal-padding, 40px);

        // The content of the view (at --preview-panel-gap from the preview column) and the preview (against the left
        // side of its column, with 30px padding) are centered together
        grid-template-columns: minmax(0, 1fr) max(var(--preview-panel-width, 450px), calc(50% - (var(--st-view-max-width, 600px) + var(--preview-panel-gap, 80px) + 30px - var(--preview-panel-width, 450px)) / 2));

        > .preview-panel-view {
            container-type: inline-size;

            .st-view:not(.st-view .st-view) {
                // Move the content of the view against the preview instead of centering it in its column
                --preview-panel-view-padding-left: max(var(--preview-panel-view-padding), calc(100cqw - var(--st-view-max-width, 600px) - var(--preview-panel-gap, 80px)));

                > main, > .st-toolbar > div {
                    padding-left: var(--preview-panel-view-padding-left);
                    padding-right: var(--preview-panel-gap, 80px);
                }

                // The legal footer runs from edge to edge of main, with margins that expect the centered padding on both sides
                > main:not(.with-legal) > .legal-footer {
                    margin-left: calc(-1 * var(--preview-panel-view-padding-left));
                    margin-right: calc(-1 * var(--preview-panel-gap, 80px));
                }
            }
        }
    }

    > .preview-panel-view {
        min-width: 0;
    }

    > .preview-panel-parking {
        display: none;
    }
}

.preview-panel-column {
    box-sizing: border-box;
    height: 100vh;
    height: 100dvh;
    height: calc(var(--vh, 1vh) * 100);
    overflow-y: auto;
    overscroll-behavior: contain;

    --st-horizontal-padding: 30px;
    --preview-panel-padding-bottom: calc(var(--st-vertical-padding, 20px) + var(--st-safe-area-bottom, 0px));
    padding: calc(var(--st-vertical-padding, 20px) + var(--st-safe-area-top, 0px)) var(--st-horizontal-padding) var(--preview-panel-padding-bottom);

    // Keep the content as wide as in the narrowest column (a percentage is relative to the width of the column)
    padding-right: max(var(--st-horizontal-padding), calc(100% - var(--preview-panel-width, 450px) + var(--st-horizontal-padding)));

    background: $color-background-shade;
    --color-current-background: #{$color-background-shade};
    --color-current-background-shade: #{$color-background-shade-darker};
    --color-current-background-shade-darker: #{$color-background-shade-darker-darker};
    --rgb-current-background: var(--rgb-background-shade, 255);

    > .preview-panel-actions {
        // Directly below the preview, but stays visible at the bottom when the preview is longer than the screen
        position: sticky;
        z-index: 1;
        bottom: calc(-1 * var(--preview-panel-padding-bottom));
        margin-bottom: calc(-1 * var(--preview-panel-padding-bottom));
        // A margin instead of padding: when it sticks, the content stays visible right up to the button
        margin-top: 20px;
        padding: 0 0 var(--preview-panel-padding-bottom) 0;
        background: $color-background-shade;
    }
}

.preview-outlet {
    // The horizontal padding of the main of the view (see st-view.scss), so the preview can run from edge to edge of the display
    --preview-outlet-padding-left: max(var(--st-view-center-padding, 0px), var(--st-horizontal-padding, 40px), var(--st-safe-area-left, 0px));
    --preview-outlet-padding-right: max(var(--st-view-center-padding, 0px), var(--st-horizontal-padding, 40px), var(--st-safe-area-right, 0px));
    margin-left: calc(-1 * var(--preview-outlet-padding-left));
    margin-right: calc(-1 * var(--preview-outlet-padding-right));
}

// At the end of the view, the preview takes over the bottom padding of main (see st-view.scss), so no white gap remains
.st-view > main:has(> .preview-outlet:last-child > .preview-panel-preview) {
    padding-bottom: 0;

    // The preview fills the remaining height when the content is shorter than the view (also in a centered view,
    // where main normally only grows to its content)
    display: flex;
    flex-direction: column;
    flex-grow: 1;

    > .preview-outlet {
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        > .preview-panel-preview {
            flex-grow: 1;
        }
    }

    > .preview-outlet > .preview-panel-preview {
        padding-bottom: calc(30px + max(var(--keyboard-height, 0px), var(--bottom-padding, 0px)));
    }

    &:last-child > .preview-outlet > .preview-panel-preview {
        padding-bottom: calc(30px + max(var(--st-safe-area-bottom, 0px), var(--keyboard-height, 0px), var(--bottom-padding, 0px)));
    }
}

.preview-outlet > .preview-panel-preview {
    // Aligned with the content of the view
    padding: 20px var(--preview-outlet-padding-right) 30px var(--preview-outlet-padding-left);

    background: $color-background-shade;
    --color-current-background: #{$color-background-shade};
    --color-current-background-shade: #{$color-background-shade-darker};
    --color-current-background-shade-darker: #{$color-background-shade-darker-darker};
    --rgb-current-background: var(--rgb-background-shade, 255);
}
</style>
