import { AppManager } from "@stamhoofd/networking";

export class ViewportHelper {
    static currentVh: number | null = null
    static modern = false
    static supportsDvh = this.checkDvh();

    static checkDvh() {
        const element = document.createElement("div");
        element.style.height = "100dvh";
        //element.inert = true;

        document.body.appendChild(element);
        const height = parseInt(getComputedStyle(element, null).height, 10);
        document.body.removeChild(element);
        return height > 0;
    }

    static getScrollElement(element: HTMLElement): HTMLElement {
        const style = window.getComputedStyle(element);
        if (style.overflowY == "scroll" || style.overflow == "scroll" || style.overflow == "auto" || style.overflowY == "auto" || style.overflow == "overlay" || style.overflowY == "overlay") {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    static setup(modern = true) {
        this.modern = modern
        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (isPrerender) {
            return
        }        
        // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
        this.setVh(window.innerHeight ?? document.body.clientHeight)

        if ('virtualKeyboard' in navigator) {
            // The VirtualKeyboard API is supported!
            (navigator as any).virtualKeyboard.overlaysContent = true;
        }

        const w = window as any;
        if (w.visualViewport) {
            let pendingUpdate = false;
            const viewportHandler = (event) => {
                //if (pendingUpdate) return;
                pendingUpdate = true;

                requestAnimationFrame(() => {
                    pendingUpdate = false;
                    const viewport = event.target;
                    const height = w.visualViewport?.height;

                    this.setVh(height);
                });
            };
            //w.visualViewport.addEventListener('scroll', viewportHandler);
            w.visualViewport.addEventListener('resize', viewportHandler);

            // on iPad resize is not called so we cannot reliably calculate the keyboard height
            // const resizeObserver = new ResizeObserver(viewportHandler);
            // resizeObserver.observe(document.body);
        } else {
            // We listen to the resize event
            window.addEventListener(
                "resize",
                () => {
                    // We execute the same script as before
                    this.setVh(window.innerHeight ?? document.body.clientHeight);
                },
                { passive: true } as EventListenerOptions
            );

            // We listen to the resize event
            window.addEventListener(
                "focus",
                () => {
                    // We execute the same script as before
                    this.setVh(window.innerHeight ?? document.body.clientHeight);
                },
                { passive: true } as EventListenerOptions
            );
        }

        if (modern) {
            // Disable scrolling the body
            // + force overflow contain on browsers that doen't support the property

            // on iOS, when the keyboard is visible, and when the user already scrolled to the bottom of the scroll views
            // the user can scroll further to scroll on the body, even if overflow is hidden. To prevent this
            // we correct the scroll position
            window.addEventListener("scroll", () => {
                // Disalbe scrolling the body
                requestAnimationFrame(() => {
                    if (document.documentElement.scrollTop > 0) {
                        document.documentElement.scrollTop = 0
                    }

                    // Fixes an iOS bug where documentElement is not scrolled, but body is
                    if (document.body.scrollTop > 0) {
                        document.body.scrollTop = 0
                    }
                });
            }, { passive: true });

            if (AppManager.shared.getOS() === "iOS") {
                let clickedElement: HTMLElement | null = null;
                
                document.body.addEventListener("touchstart", (event) => {
                    if (!event.target) {
                        clickedElement = null
                        return;
                    }
                    const scrollElement = this.getScrollElement(event.target as HTMLElement)

                    if (scrollElement === document.documentElement || scrollElement.tagName !== "MAIN") {
                        clickedElement = null
                        return
                    }

                    clickedElement = scrollElement;
                    // Show bottom scroll if we are idle at the bottom

                    if (scrollElement.scrollTop == 0 && scrollElement.scrollHeight > scrollElement.clientHeight) {
                        let paddingTop = parseInt(window.getComputedStyle(scrollElement, null).getPropertyValue('padding-top'))
                        paddingTop = isNaN(paddingTop) ? 0 : paddingTop

                        scrollElement.style.paddingTop = `${paddingTop + 1}px`
                        scrollElement.scrollTop = 1
                    } else if (scrollElement.scrollTop == scrollElement.scrollHeight - scrollElement.clientHeight) {
                        let paddingBottom = parseInt(window.getComputedStyle(scrollElement, null).getPropertyValue('padding-bottom'))
                        paddingBottom = isNaN(paddingBottom) ? 0 : paddingBottom

                        const scrollPosition = scrollElement.scrollTop
                        scrollElement.style.paddingBottom = `${paddingBottom + 1}px`

                        // Prevent the browser from keepign the scroll position at the bottom.
                        // We need 1 pixel outside the scroll view, so the browser thinks it can scroll in this view,
                        // so we can prevent that the browser will scroll a different view than this one
                        scrollElement.scrollTop = scrollPosition
                    }
                }, { passive: true })

                document.body.addEventListener("touchend", (event) => {
                    // Scrollby fixes it on iOS
                    // setTimeout(() => {
                    //     requestAnimationFrame(() => {
                    //         window.scrollBy({
                    //             top: -1000
                    //         })
                    //     });
                    // }, 200)

                    if (!clickedElement) {
                        // Force scroll back to top
                        document.body.scrollTop = 0; // window.scrollTo doesn't work on iOS (not always)
                        return
                    }

                    clickedElement.style.paddingTop = ""
                    clickedElement.style.paddingBottom = ""

                    if (clickedElement.scrollTop == 1) {
                        clickedElement.scrollTop = 0
                    }

                    // Force scroll back to top
                    document.body.scrollTop = 0; // window.scrollTo doesn't work on iOS (not always)

                    clickedElement = null
                }, { passive: true })
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            document.body.addEventListener("touchstart", () => { }, { passive: true });
        }
    }

    static setVh(viewportHeight: number) {
        
        const vh = Math.floor(viewportHeight) / 100;
        if (!this.currentVh || vh.toFixed(2) != this.currentVh.toFixed(2)) {
            this.currentVh = vh
  
            if (!this.supportsDvh) {
                document.documentElement.style.setProperty("--vh", `${vh.toFixed(2)}px`);  
            }
        }

        if ('virtualKeyboard' in navigator) {
            // The VirtualKeyboard API is supported!
            // AWESOME!!!
            return;
        }

        // Calculate bottom padding
        // In modern mode, the body is set to 100dvh / 100vh, and we need to calculate the difference between 100vh and the viewport height
        // This can be used to calculate the keyboard height
        if (AppManager.shared.getOS() === "iOS") {
            if (window.visualViewport && this.modern) {
                const bodyHeight = (window.innerHeight ?? document.body.clientHeight) + window.scrollY;
                const bottomPadding = bodyHeight - window.visualViewport.height

                console.log('set vh', viewportHeight, bodyHeight, bottomPadding, window.scrollY)

                if (bottomPadding > 200) {
                    // We are showing the keyboard
                    document.documentElement.style.setProperty("--keyboard-height", `${bottomPadding.toFixed(2)}px`);
                    document.documentElement.style.setProperty("--bottom-padding", `0px`);

                    document.documentElement.style.setProperty("--keyboard-open", `1`);
                    document.documentElement.style.setProperty("--keyboard-closed", `0`);

                } else {
                    document.documentElement.style.setProperty("--bottom-padding", `${bottomPadding.toFixed(2)}px`);
                    document.documentElement.style.setProperty("--keyboard-height", `0px`);

                    document.documentElement.style.setProperty("--keyboard-open", `0`);
                    document.documentElement.style.setProperty("--keyboard-closed", `1`);
                }
            }
        }
    }

    static getBottomPadding() {
        if (window.visualViewport && this.modern) {
            const bodyHeight = window.innerHeight ?? document.body.clientHeight;
            const bottomPadding = bodyHeight - window.visualViewport.height

            return Math.round(bottomPadding)
        }
        return 0

    }

    static scrollIntoView(element: HTMLElement) {
        // default scrollIntoView is broken on Safari and sometimes causes the scrollview to scroll too far and get stuck
        const scrollElement = ViewportHelper.getScrollElement(element)
        const elRect = element.getBoundingClientRect()
        const scrollRect = scrollElement.getBoundingClientRect()

        let scrollPosition = elRect.bottom - scrollRect.top - scrollElement.clientHeight + scrollElement.scrollTop
        // TODO: add the bottom padding of scrollRect as an extra offset (e.g. for the keyboard of st-view)

        let bottomPadding = parseInt(window.getComputedStyle(scrollElement, null).getPropertyValue('padding-bottom'))
        if (isNaN(bottomPadding)) {
            bottomPadding = 25
        }
        let elBottomPadding = parseInt(window.getComputedStyle(element, null).getPropertyValue('padding-bottom'))
        if (isNaN(elBottomPadding)) {
            elBottomPadding = 0
        }
        scrollPosition += Math.max(0, bottomPadding - elBottomPadding)
        scrollPosition = Math.max(0, Math.min(scrollPosition, scrollElement.scrollHeight - scrollElement.clientHeight))

        const exponential = function(x: number): number {
            return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
        }

        ViewportHelper.scrollTo(scrollElement, scrollPosition, Math.min(600, Math.max(300, Math.abs(element.scrollTop - scrollPosition) / 2)), exponential)
    }

    /**
     * Smooth scroll polyfill for Safari
     */
    static scrollTo(element: HTMLElement, endPosition: number, duration: number, easingFunction: (t: number) => number) {
        //const duration = Math.min(600, Math.max(300, element.scrollTop / 2)) // ms
        let start: number
        let previousTimeStamp: number

        const startPosition = element.scrollTop

        let previousPosition = element.scrollTop

        element.style.willChange = "scroll-position";
        (element.style as any).webkitOverflowScrolling = "auto"
        element.style.overflow = "hidden"

        // animate scrollTop of element to zero
        const step = function (timestamp) {
            if (start === undefined) {
                start = timestamp;

            }
            const elapsed = timestamp - start;

            if (element.scrollTop !== previousPosition && start !== timestamp){
                // The user has scrolled the page: stop animation
                element.style.overflow = ""
                element.style.willChange = "";
                (element.style as any).webkitOverflowScrolling = ""
                return
            }

            if (previousTimeStamp !== timestamp) {
                // Math.min() is used here to make sure the element stops at exactly 200px
                element.scrollTop = Math.round((startPosition - endPosition) * (1 - easingFunction(elapsed / duration)) + endPosition)
                element.style.overflow = ""
            }

            if (elapsed < duration) { // Stop the animation after 2 seconds
                previousTimeStamp = timestamp
                previousPosition = element.scrollTop
                window.requestAnimationFrame(step);
            } else {
                element.scrollTop = endPosition
                element.style.overflow = ""
                element.style.willChange = "";
                (element.style as any).webkitOverflowScrolling = ""
            }
        }

        window.requestAnimationFrame(step);
    }
}
