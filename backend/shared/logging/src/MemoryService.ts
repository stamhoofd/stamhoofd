import os from 'node:os';
import v8 from 'node:v8';

export type MemorySample = {
    /** Bytes in use on the V8 heap */
    heapUsed: number;
    /** Hard heap limit V8 was started with (--max-old-space-size); the process aborts when it needs more */
    heapLimit: number;
    rss: number;
    /** Memory Node allocates outside the V8 heap (Buffers, sharp, sockets) */
    external: number;
    systemTotal: number;
    /** On Linux this is MemAvailable: what the kernel can hand out without swapping */
    systemAvailable: number;
};

const MiB = 1024 * 1024;

/** Binary units, so a limit set with --max-old-space-size=4096 reads back as 4.0 GiB */
function formatBytes(bytes: number): string {
    if (bytes >= 1024 * MiB) {
        return (bytes / 1024 / MiB).toFixed(1) + ' GiB';
    }
    return Math.round(bytes / MiB) + ' MiB';
}

function formatPercentage(ratio: number): string {
    return Math.round(ratio * 100) + '%';
}

function heapRatio(sample: MemorySample): number {
    return sample.heapUsed / sample.heapLimit;
}

function systemUsedRatio(sample: MemorySample): number {
    return 1 - sample.systemAvailable / sample.systemTotal;
}

class StaticMemoryService {
    /**
     * Sustained (one minute average) share of the heap limit above which V8 spends most of its
     * time in full GCs before it finally aborts the process.
     */
    heapWarningRatio = 0.85;

    /** A single sample at or above this share of the heap limit is reported right away: the crash is seconds away. */
    heapCriticalRatio = 0.95;

    /**
     * Sustained (one minute average) share of system memory in use above which Linux starts
     * swapping, which stalls the event loop, and the OOM killer becomes a risk for every process on
     * the host (MySQL included).
     */
    systemUsedWarningRatio = 0.9;

    /**
     * A single sample at or above this share of system memory in use is reported right away, so a
     * sudden grab by another process (a backup, MySQL) is caught before the average catches up.
     */
    systemUsedCriticalRatio = 0.95;

    /** Seconds between two samples */
    private readonly sampleIntervalSeconds = 5;

    /** The window the sustained checks average over, in samples */
    private readonly windowSize = 60 / this.sampleIntervalSeconds;

    /** Log every this many samples while everything is fine; every sample while in the warning zone */
    private readonly logEvery = 60 / this.sampleIntervalSeconds;

    private samples: MemorySample[] = [];
    private sampleCount = 0;
    private interval?: NodeJS.Timeout;

    takeSample(): MemorySample {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed,
            heapLimit: v8.getHeapStatistics().heap_size_limit,
            rss: usage.rss,
            external: usage.external,
            systemTotal: os.totalmem(),
            systemAvailable: os.freemem(),
        };
    }

    /** Adds a sample to the window the health check looks at */
    record(sample: MemorySample) {
        this.samples.push(sample);
        if (this.samples.length > this.windowSize) {
            this.samples.shift();
        }
    }

    getLastSample(): MemorySample | null {
        return this.samples[this.samples.length - 1] ?? null;
    }

    /** Average share of the heap limit in use over the window, or 0 when nothing was sampled yet */
    getHeapRatio(): number {
        return this.average(heapRatio);
    }

    /** Average share of system memory in use over the window, or 0 when nothing was sampled yet */
    getSystemUsedRatio(): number {
        return this.average(systemUsedRatio);
    }

    /**
     * Human readable problems for the health endpoint. A critical last sample is reported at once;
     * anything below that has to hold on the one minute average, like the CPU check, so a short
     * peak (one image resize) doesn't flip the health status.
     */
    getErrors(): string[] {
        const last = this.getLastSample();
        if (!last) {
            return [];
        }

        const errors: string[] = [];
        const averageHeapRatio = this.getHeapRatio();
        const averageSystemUsedRatio = this.getSystemUsedRatio();

        if (heapRatio(last) >= this.heapCriticalRatio) {
            errors.push(`Heap memory usage is critical: ${formatBytes(last.heapUsed)} of ${formatBytes(last.heapLimit)} (${formatPercentage(heapRatio(last))})`);
        } else if (averageHeapRatio > this.heapWarningRatio) {
            errors.push(`Heap memory usage is too high: ${formatBytes(last.heapUsed)} of ${formatBytes(last.heapLimit)} (${formatPercentage(averageHeapRatio)} average)`);
        }

        if (systemUsedRatio(last) >= this.systemUsedCriticalRatio) {
            errors.push(`System memory is exhausted: ${formatBytes(last.systemAvailable)} available of ${formatBytes(last.systemTotal)} (${formatPercentage(systemUsedRatio(last))} used)`);
        } else if (averageSystemUsedRatio > this.systemUsedWarningRatio) {
            errors.push(`System memory is almost exhausted: ${formatBytes(last.systemAvailable)} available of ${formatBytes(last.systemTotal)} (${formatPercentage(averageSystemUsedRatio)} used on average)`);
        }

        return errors;
    }

    isInWarningZone(): boolean {
        return this.getErrors().length > 0;
    }

    formatSample(sample: MemorySample): string {
        return `[MEMORY] heap: ${formatBytes(sample.heapUsed)} / ${formatBytes(sample.heapLimit)} (${formatPercentage(heapRatio(sample))}), rss: ${formatBytes(sample.rss)}, external: ${formatBytes(sample.external)}\n`
            + `[MEMORY] system available: ${formatBytes(sample.systemAvailable)} / ${formatBytes(sample.systemTotal)} (${formatPercentage(sample.systemAvailable / sample.systemTotal)})`;
    }

    private saveSample() {
        const sample = this.takeSample();
        this.record(sample);
        this.sampleCount++;

        if (this.sampleCount % this.logEvery === 0 || this.isInWarningZone()) {
            console.log(this.formatSample(sample));
        }
    }

    startMonitoring() {
        if (this.interval) {
            return;
        }
        this.saveSample();
        this.interval = setInterval(() => {
            this.saveSample();
        }, this.sampleIntervalSeconds * 1000);
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }

    clearForTesting() {
        this.stopMonitoring();
        this.samples = [];
        this.sampleCount = 0;
    }

    private average(map: (sample: MemorySample) => number): number {
        if (this.samples.length === 0) {
            return 0;
        }
        return this.samples.reduce((sum, s) => sum + map(s), 0) / this.samples.length;
    }
}

export const MemoryService = new StaticMemoryService();
