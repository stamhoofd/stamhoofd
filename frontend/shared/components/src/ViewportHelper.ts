export class ViewportHelper {
    static currentVh: number | null = null

    static getScrollElement(element: HTMLElement): HTMLElement {
        const style = window.getComputedStyle(element);
        if (style.overflowY == "scroll" || style.overflow == "scroll" || style.overflow == "auto" || style.overflowY == "auto") {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    static setup(modern = false) {
        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (isPrerender) {
            return
        }        
        // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
        this.setVh(document.documentElement.clientHeight)

        const w = window as any;
        if (w.visualViewport) {
            let pendingUpdate = false;
            const viewportHandler = (event) => {
                if (pendingUpdate) return;
                pendingUpdate = true;

                requestAnimationFrame(() => {
                    pendingUpdate = false;
                    const viewport = event.target;
                    const height = viewport.height;

                    this.setVh(height);
                });
            };
            //w.visualViewport.addEventListener('scroll', viewportHandler);
            w.visualViewport.addEventListener('resize', viewportHandler);
        } else {
            // We listen to the resize event
            window.addEventListener(
                "resize",
                () => {
                    // We execute the same script as before
                    this.setVh(document.documentElement.clientHeight);
                },
                { passive: true } as EventListenerOptions
            );

            // We listen to the resize event
            window.addEventListener(
                "focus",
                () => {
                    // We execute the same script as before
                    this.setVh(document.documentElement.clientHeight);
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
                });
            }, { passive: true });

            // Todo: only execute the following codeon touch devices where scroll contain is not supported

            let clickedElement: HTMLElement | null = null;
            
            document.body.addEventListener("touchstart", (event) => {
                if (!event.target) {
                    clickedElement = null
                    return;
                }
                const scrollElement = this.getScrollElement(event.target as HTMLElement)

                if (scrollElement === document.documentElement || scrollElement.tagName !== "MAIN") {
                    console.log("Siipped", scrollElement)
                    clickedElement = null
                    return
                }

                clickedElement = scrollElement;
                // Show bottom scroll if we are idle at the bottom

                if (scrollElement.scrollTop == 0) {
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

            document.body.addEventListener("touchend", () => {
                if (!clickedElement) {
                    return
                }
                // Show bottom scroll if we are idle at the bottom

                clickedElement.style.paddingTop = ""
                clickedElement.style.paddingBottom = ""

                // Force scroll back to top
                window.scrollTo(0,0);

                clickedElement = null
            }, { passive: true })
        } else {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            document.body.addEventListener("touchstart", () => { }, { passive: true });
        }
    }

    static setVh(viewportHeight: number) {
        const vh = Math.floor(viewportHeight) / 100;
        if (!this.currentVh || vh.toFixed(2) != this.currentVh.toFixed(2)) {
            this.currentVh = vh
            document.documentElement.style.setProperty("--vh", `${vh.toFixed(2)}px`);

            // Calculate bottom padding
            // In modern mode, the body is set to 100vh, and we need to calculate the difference between 100vh and the viewport height
            // This can be used to calculate the keyboard height
            if (window.visualViewport) {
                const bodyHeight = document.body.clientHeight;
                const bottomPadding = bodyHeight - window.visualViewport.height

                if (bottomPadding > 250) {
                    // We are showing the keyboard
                    document.documentElement.style.setProperty("--keyboard-height", `${bottomPadding.toFixed(2)}px`);
                    document.documentElement.style.setProperty("--bottom-padding", `0px`);
                } else {
                    document.documentElement.style.setProperty("--bottom-padding", `${bottomPadding.toFixed(2)}px`);
                    document.documentElement.style.setProperty("--keyboard-height", `0px`);
                }
            }
            
        }
    }
}