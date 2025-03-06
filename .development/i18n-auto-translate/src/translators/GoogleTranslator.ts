import {
    GenerativeModel,
    GoogleGenerativeAI,
    Schema,
    SchemaType,
} from "@google/generative-ai";
import { globals } from "../globals";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class GoogleTranslator extends Translator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<(string | null)[]>(3, 500);

    constructor(manager: TranslationManager) {
        super(manager);
        this.genAI = new GoogleGenerativeAI(globals.GEMINI_API_KEY);

        const schema: Schema = {
            description: "List of translations",
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.STRING,
            },
        };

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const apiResult = await this.model.generateContent(prompt);
        return apiResult.response.text();
    }

    protected override transformParsedJson<T>(parsedJson: T): T {
        if(Array.isArray(parsedJson)) {
            return parsedJson.map(value => {
                if(typeof value === 'string' && value.trim().length === 0) {
                    return null;
                }

                return value;
            }) as T;
        }

        return parsedJson;
    }
}
