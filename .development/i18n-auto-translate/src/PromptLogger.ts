import winston from "winston";

function formatDuration(durationMs: number): string {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor(durationMs / 1000) % 60;
    const ms = durationMs % 1000;

    if (minutes > 0) return `${minutes}m ${seconds}s ${ms}ms `;
    if (seconds > 0) return `${seconds}s ${ms}ms`;
    return `${ms}ms`;
}

      const timerFormat = winston.format.printf(
        ({ durationMs, message }: any) => {
            const durationText = formatDuration(durationMs);
            return `${message}

- Completion time: ${durationText}`
        }
      );

class PromptLogger {
    private readonly winstonLogger = winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [
          new winston.transports.File({ filename: 'prompts.log',  format: timerFormat,
            options: { flags: "w" }, }),
        ],
      });



      info(value: string) {
        this.winstonLogger.info(value);
      }

      logPrompt(prompt: string, args: { originalLocal: string; targetLocal: string; namespace: string; batchNumber: number, totalBatches: number}) {
        const now = new Date();


        const promptString = `[PROMPT]
${prompt}`;

        const profiler = this.winstonLogger.startTimer();

        return (result: string) => {
            const resultString = `[RESULT]
${result}`;
            const message = `
Start prompt at ${now.toISOString()}
Original local: ${args.originalLocal}
Target local: ${args.targetLocal}
Namespace: ${args.namespace}
Batch: ${args.batchNumber} of ${args.totalBatches}

${promptString}

${resultString}`;

            profiler.done({ message: message })
        }
      }
}

export const promptLogger = new PromptLogger();
