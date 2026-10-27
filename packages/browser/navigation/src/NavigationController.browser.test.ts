import { afterEach, describe, expect, test } from 'vitest';
import { createApp, defineComponent, h, nextTick, onMounted, ref, type App } from 'vue';

import { ComponentWithProperties } from './ComponentWithProperties.js';
import NavigationController from './NavigationController.vue';
import { useAnimateHeightChange, useContentState } from './utils/navigationHooks.js';

const VIEW_WIDTH = 320;
const INITIAL_HEIGHT = 240;
const CONTENT_HEIGHT = 360;
const RESIZED_HEIGHT = 420;
const MID_NAVIGATION_HEIGHT = 300;
const RETARGETED_HEIGHT = 800;

const CONTENT_ANIMATION_DURATION = 1_000;
const NAVIGATION_ANIMATION_DURATION = 1_000;
const MAX_CHANGE_FRACTION = 0.1;

let app: App<Element> | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = null;
    host = null;
});
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('NavigationController size animations', () => {
    test('does not collapse while content loads and grows smoothly when it arrives', async () => {
        let revealContent!: (() => Promise<void>);
        let abruptResizeContent!: (() => Promise<void>);

        const InitialView = fixedHeightView('Initial view', INITIAL_HEIGHT);
        const AsyncView = defineComponent({
            name: 'AsyncView',
            setup() {
                const hasContent = ref(false);
                const height = ref(CONTENT_HEIGHT);
                const setHasContent = useContentState();
                let text = ref('Loading...')

                setHasContent(false);
                revealContent = async () => {
                    hasContent.value = true;
                    text.value = 'Loaded content'
                    await nextTick();
                    setHasContent(true);
                };
                abruptResizeContent = async () => {
                    text.value = 'Resized content'
                    height.value = RESIZED_HEIGHT;
                    await nextTick();
                };

                return () => h('div', {
                    'data-testid': 'async-view',
                    'style': viewStyle(hasContent.value ? height.value : 0),
                }, text.value);
            },
        });

        const initial = new ComponentWithProperties(InitialView);
        const asyncView = new ComponentWithProperties(AsyncView);
        const controller = await mountController(initial);
        const element = getControllerElement();

        expect(element.getBoundingClientRect().width).toBeCloseTo(VIEW_WIDTH, 0);
        expect(element.getBoundingClientRect().height).toBeCloseTo(INITIAL_HEIGHT, 0);

        const pushPromise = controller.push({
            components: [asyncView],
            animated: true,
            adjustHistory: false,
        });
        const loadingFrames = await sampleHeights(element, NAVIGATION_ANIMATION_DURATION + 200);
        await pushPromise;

        expect(Math.min(...loadingFrames.map(frame => frame.height))).toBeGreaterThanOrEqual(INITIAL_HEIGHT - 1);
        expect(Math.max(...loadingFrames.map(frame => frame.height))).toBeLessThanOrEqual(INITIAL_HEIGHT + 1);
        expect(element.getBoundingClientRect().height).toBeCloseTo(INITIAL_HEIGHT, 0);

        await revealContent();
        const revealFrames = await sampleHeights(element, CONTENT_ANIMATION_DURATION + 150);
        const revealHeights = revealFrames.map(frame => frame.height);

        expect(Math.min(...revealHeights)).toBeGreaterThanOrEqual(INITIAL_HEIGHT - 1);
        expect(Math.max(...revealHeights)).toBeLessThanOrEqual(CONTENT_HEIGHT + 1);
        expect(revealHeights.some(height => height > INITIAL_HEIGHT + 10 && height < CONTENT_HEIGHT - 10)).toBe(true);
        expectMaximumHeightChange(
            revealFrames,
            CONTENT_ANIMATION_DURATION * MAX_CHANGE_FRACTION,
            (CONTENT_HEIGHT - INITIAL_HEIGHT) * MAX_CHANGE_FRACTION,
        );
        expect(element.getBoundingClientRect().height).toBeCloseTo(CONTENT_HEIGHT, 0);

        // This is not animated
        await abruptResizeContent();
        await nextFrame();
        expect(element.getBoundingClientRect().width).toBeCloseTo(VIEW_WIDTH, 0);
        expect(element.getBoundingClientRect().height).toBeCloseTo(RESIZED_HEIGHT, 0);
    });

    test('retargets an in-progress navigation height animation', async () => {
        let animateToRetargetedHeight!: () => Promise<void>;
        const InitialView = fixedHeightView('Initial view', INITIAL_HEIGHT);
        const RetargetingView = defineComponent({
            name: 'RetargetingView',
            setup() {
                const height = ref(MID_NAVIGATION_HEIGHT);
                const animateHeightChange = useAnimateHeightChange();

                animateToRetargetedHeight = async () => {
                    await animateHeightChange(() => {
                        height.value = RETARGETED_HEIGHT;
                    });
                };

                return () => h('div', {
                    'data-testid': 'retargeting-view',
                    'style': viewStyle(height.value),
                }, 'Retargeting view');
            },
        });

        const controller = await mountController(new ComponentWithProperties(InitialView));
        const element = getControllerElement();
        expect(element.getBoundingClientRect().width).toBeCloseTo(VIEW_WIDTH, 0);
        const pushPromise = controller.push({
            components: [new ComponentWithProperties(RetargetingView)],
            animated: true,
            adjustHistory: false,
        });

        await sleep(CONTENT_ANIMATION_DURATION / 2);
        const heightBeforeRetarget = await waitForHeightChange(element, INITIAL_HEIGHT);
        expect(heightBeforeRetarget).toBeGreaterThan(INITIAL_HEIGHT);
        expect(heightBeforeRetarget).toBeLessThan(MID_NAVIGATION_HEIGHT);

        await animateToRetargetedHeight();
        const retargetedFrames = await sampleHeights(element, CONTENT_ANIMATION_DURATION + 150);
        const retargetedHeights = retargetedFrames.map(frame => frame.height);
        await pushPromise;

        expect(Math.min(...retargetedHeights)).toBeGreaterThanOrEqual(INITIAL_HEIGHT - 1);
        expect(Math.max(...retargetedHeights)).toBeLessThanOrEqual(RETARGETED_HEIGHT + 1);
        expect(retargetedHeights.some(height => height > MID_NAVIGATION_HEIGHT && height < RETARGETED_HEIGHT)).toBe(true);
        expectMaximumHeightChange(
            retargetedFrames,
            CONTENT_ANIMATION_DURATION * MAX_CHANGE_FRACTION,
            (RETARGETED_HEIGHT - heightBeforeRetarget) * MAX_CHANGE_FRACTION,
        );
        expect(element.getBoundingClientRect().width).toBeCloseTo(VIEW_WIDTH, 0);
        expect(element.getBoundingClientRect().height).toBeCloseTo(RETARGETED_HEIGHT, 0);
    });
});

function fixedHeightView(name: string, height: number) {
    return defineComponent({
        name: name.replaceAll(' ', ''),
        setup() {
            return () => h('div', {
                'data-testid': name.toLowerCase().replaceAll(' ', '-'),
                'style': viewStyle(height),
            }, name);
        },
    });
}

function viewStyle(height: number) {
    return {
        boxSizing: 'border-box',
        height: `${height}px`,
        width: `${VIEW_WIDTH}px`,
        border: `5px solid black`,
        background: 'white',
    };
}

async function mountController(root: ComponentWithProperties) {
    let resolveController: (controller: InstanceType<typeof NavigationController>) => void;
    const mounted = new Promise<InstanceType<typeof NavigationController>>((resolve) => {
        resolveController = resolve;
    });

    const TestApp = defineComponent({
        setup() {
            const controller = ref<InstanceType<typeof NavigationController> | null>(null);
            onMounted(() => resolveController(controller.value!));
            return () => h(NavigationController, {
                ref: controller,
                root,
            });
        },
    });

    host = document.createElement('div');
    host.innerHTML = `
        <style>
            .mount {
                width: ${VIEW_WIDTH}px;
            }

            .navigation-controller {
                --navigation-transition-duration: ${NAVIGATION_ANIMATION_DURATION}ms;
                --navigation-pop-transition-duration: ${NAVIGATION_ANIMATION_DURATION}ms;
                transition: height ${CONTENT_ANIMATION_DURATION}ms linear, width ${CONTENT_ANIMATION_DURATION}ms linear;
                outline: 5px solid red;
                overflow: hidden;
            }
        </style>
        <div class="mount"></div>
    `;
    document.body.append(host);
    app = createApp(TestApp);
    app.mount(host.querySelector('.mount')!);

    await nextTick();
    await nextFrame();

    // Wait for navigation finished
    await sleep(2_000);
    return await mounted;
}

async function waitForHeightChange(element: HTMLElement, initialHeight: number) {
    const timeoutAt = performance.now() + NAVIGATION_ANIMATION_DURATION;
    while (performance.now() < timeoutAt) {
        const height = element.getBoundingClientRect().height;
        if (height > initialHeight + 1) {
            return height;
        }
        await nextFrame();
    }
    throw new Error('NavigationController height did not start changing');
}

function getControllerElement() {
    const element = host?.querySelector<HTMLElement>('.navigation-controller');
    if (!element) {
        throw new Error('NavigationController did not render');
    }
    return element;
}

async function sampleHeights(element: HTMLElement, duration: number) {
    const frames: { time: number; height: number }[] = [];
    const startedAt = performance.now();

    do {
        frames.push({
            time: performance.now() - startedAt,
            height: element.getBoundingClientRect().height,
        });
        await nextFrame();
    } while (performance.now() - startedAt < duration);

    frames.push({
        time: performance.now() - startedAt,
        height: element.getBoundingClientRect().height,
    });
    return frames;
}

function expectMaximumHeightChange(
    frames: { time: number; height: number }[],
    period: number,
    maximumChange: number,
) {
    const renderingTolerance = 1;
    let largestChange = 0;

    for (let startIndex = 0; startIndex < frames.length; startIndex++) {
        const start = frames[startIndex];
        for (let endIndex = startIndex + 1; endIndex < frames.length; endIndex++) {
            const end = frames[endIndex];
            if (end.time - start.time > period) {
                break;
            }
            largestChange = Math.max(largestChange, Math.abs(end.height - start.height));
        }
    }

    expect(largestChange).toBeLessThanOrEqual(maximumChange + renderingTolerance);
}

function nextFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
