export class ViewportHelper {
    static currentVh: number | null = null

    static setup() {
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

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        document.body.addEventListener("touchstart", () => { }, { passive: true });
    }

    static setVh(viewportHeight: number) {
        const vh = Math.floor(viewportHeight) / 100;
        if (!this.currentVh || vh.toFixed(2) != this.currentVh.toFixed(2)) {
            this.currentVh = vh
            document.documentElement.style.setProperty("--vh", `${vh.toFixed(2)}px`);
        }
    }
}