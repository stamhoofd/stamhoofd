import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export function useInterval(method: (data: { stop: () => void }) => unknown, ms: number) {
    let interval: ReturnType<typeof setInterval> | undefined;

    const data = {
        stop: clear,
    };

    const running = ref(false);
    const handler = async () => {
        if (running.value) {
            return;
        }
        running.value = true;
        try {
            await method(data);
        }
        catch (e) {
            console.error('Error in useInterval', e);
        }
        running.value = false;
    };

    function start() {
        if (interval) {
            return;
        }
        console.log('Starting interval', ms);
        interval = setInterval(() => {
            handler().catch(console.error);
        }, ms);
    }

    function clear() {
        console.log('Clearing interval');
        if (interval) {
            clearInterval(interval);
            interval = undefined;
        }
    }

    onBeforeUnmount(() => {
        clear();
    });

    onMounted(() => {
        start();
    });

    onDeactivated(() => {
        clear();
    });

    onActivated(() => {
        start();
    });
}
