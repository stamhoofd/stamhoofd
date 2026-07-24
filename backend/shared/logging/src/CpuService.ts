class StaticCpuService {
    samples: number[];
    private maxSamples: number;
    private interval?: NodeJS.Timeout;
    // Current index = the last saved
    private currentIndex = 0;

    /**
     * Called after every saved sample with the current 5s average CPU usage. Kept generic so
     * consumers (e.g. the api tuning SQL slow-query logging) can react to load without this
     * package depending on them.
     */
    private sampleListeners: ((average5s: number) => void)[] = [];

    constructor() {
        this.maxSamples = 5 * 60; // 5 minutes of data
        this.samples = new Array(this.maxSamples).fill(0);
    }

    /**
     * Get a live sample of CPU usage
     * @param samplingInterval
     * @returns
     */
    async takeSample(samplingInterval = 500): Promise<number> {
        const startUsage = process.cpuUsage();
        const startTime = process.hrtime.bigint();

        return new Promise((resolve) => {
            setTimeout(() => {
                const elapsedUsage = process.cpuUsage(startUsage);
                const elapsedTime = process.hrtime.bigint() - startTime;

                // Convert to microseconds
                const elapsedTimeMs = Number(elapsedTime) / 1000;

                // CPU time in microseconds
                const totalCPUTime = elapsedUsage.user + elapsedUsage.system;

                // Calculate percentage
                const cpuPercent = (totalCPUTime / elapsedTimeMs) * 100;

                resolve(cpuPercent);
            }, samplingInterval);
        });
    }

    getCpuUsage(): number | undefined {
        if (this.currentIndex === 0) {
            return this.samples[this.samples.length - 1];
        }
        return this.samples[this.currentIndex - 1];
    }

    getAverage(size = this.maxSamples): number {
        if (size > this.maxSamples) {
            size = this.maxSamples;
        }
        if (size <= 0) {
            return NaN;
        }
        if (size === this.maxSamples) {
            return this.samples.reduce((a, b) => a + b, 0) / size;
        } else {
            // To read before current index
            const toReadBeforeIndex = Math.min(size, this.currentIndex);
            const toReadFromEnd = size - toReadBeforeIndex;

            // Sum performantly
            let sum = 0;
            for (let i = 0; i < toReadBeforeIndex; i++) {
                sum += this.samples[this.currentIndex - 1 - i];
            }
            for (let i = 0; i < toReadFromEnd; i++) {
                sum += this.samples[this.samples.length - 1 - i];
            }

            return sum / size;
        }
    }

    /**
     * Register a listener that is called after every saved sample with the current 5s average CPU
     * usage (in percent). Register before startMonitoring().
     */
    addSampleListener(listener: (average5s: number) => void) {
        this.sampleListeners.push(listener);
    }

    private async saveSample() {
        const sample = await this.takeSample(1000);
        this.samples[this.currentIndex] = sample;
        this.currentIndex = (this.currentIndex + 1) % this.maxSamples;
        const five = this.getAverage(5);

        if (this.currentIndex % 5 === 0 || five > 80) {
            const min = this.getAverage(60);
            console.log(`[CPU] 5s: ${five.toFixed(2)}%\n[CPU] 1 min: ${min.toFixed(2)}%\n[CPU] 5 min: ${this.getAverage(60 * 5).toFixed(2)}%`);
        }

        for (const listener of this.sampleListeners) {
            try {
                listener(five);
            }
            catch (e) {
                console.error('Error in CPU sample listener', e);
            }
        }
    }

    startMonitoring() {
        if (this.interval) {
            return;
        }
        this.interval = setInterval(() => {
            this.saveSample().catch((error) => {
                console.error('Failed to take CPU sample:', error);
            });
        }, 1000); // Sample every second
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }
}

export const CpuService = new StaticCpuService();
