import { GoogleGenAI, Type } from "@google/genai";
import type { AcknowledgementRecord, AIFlaggedRecord } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeAcknowledgements = async (records: AcknowledgementRecord[]): Promise<AIFlaggedRecord[]> => {
    if (records.length === 0) {
        return [];
    }
    
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const response = await ai.models.generateContent({
                // FIX: Use the correct model 'gemini-2.5-flash'
                model: "gemini-2.5-flash",
                contents: `

You are a data quality analyst reviewing a JSON list of image acknowledgements. 

Your job is to identify and flag records that appear incorrect, incomplete, inconsistent, or improperly formatted. 

 

For each flagged record: 

- Add a concise flag label (for example: "Redundant vendor", "Placeholder", "Misspelling", "Non-preferred vendor conflict"). 

- Provide a one-sentence concise explanation for why it was flagged. 

 

Vendor Normalization Rules: 

Other vendors are acceptable too, but there are some preferred vendos. They must appear exactly as written, with exact casing, spelling, and spacing as follows: 

- Shutterstock 

- Getty Images 

- Alamy Stock Photo 

- Bridgeman Images 

- Mauritius Images 

- Reuters 

- Science Photo Library 

- Nature Photo Library 

- OUP 

 

Source and Acknowledgement Relationship Rules 

1. Acknowledgement CAN contain any other non-preferred vendors but must NOT contain same vendor as its source or another preferred vendor name anywhere. The only exception is if there’s only source name in acknowledgement, then only the source vendor can be the acknowledgement. 

 

Here are some examples: 

Source: Shutterstock. Acknowledgement: Shutterstock (Valid. Reason: only contributor in acknowledgement but same as source) 
Source: Shutterstock. Acknowledgement: Getty Images (Invalid and to Flag. reason: only contributor in acknowledgement but NOT the source and is from the preferred list)
Source: Shutterstock. Acknowledgement: iStock (Valid. reason: only contributor in acknowledgement and is NOT the source and is NOT from the preferred list)

Source: iStock. Acknowledgement: John Smith/iStock (Invalid and to Flag. reason: source as contributor in acknowledgement when other contributors exist) 
Source: Shutterstock. Acknowledgement: John Smith/Shutterstock (Invalid and to Flag. reason: source in acknowledgement when there are other contributors) 

Source: Shutterstock. Acknowledgement: John Smith/iStock (Valid. reason: Other vendors in acknowledgement but not the source or from preferred vendors list)

Source: Corbis / Acknowledgement: Corbis (Valid. Reason: only source vendor, even though non-preferred, in acknowledgement) 

Source: Getty Images / Acknowledgement: Corbis/John Smith/iStock (Valid. reason: source Getty not as contributor in acknowledgement and no other preferred non-source vendor in acknowledgement)




Other Error Types to Flag 

 

Placeholder or junk: "test", "end", "null", "xxx", "NA" | Temporary or meaningless filler, clear typos. 

Descriptive text only: "white kitten on table" | Descriptions are not valid acknowledgements 

URL or ID strings: "www.shutterstock.com/12345", "123456789" | Should not contain URLs or numeric IDs 

Formatting errors: "Alamy Stock Photo." | Trailing punctuation or spacing issues 

Casing inconsistency: "reuters", "Getty images", "alamy stock photo" | Must match exact casing and spacing 

Whitespace or empty string: Invalid or empty acknowledgement 

Any other clear inconsistencies. 

 

            Data: ${JSON.stringify(records)}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            source: { type: Type.STRING },
                            acknowledgement: { type: Type.STRING },
                            pageNumber: { type: Type.STRING },
                            reason: { 
                                type: Type.STRING,
                                description: 'A brief, one-sentence explanation for why this record is flagged as an anomaly.'
                            }
                          },
                          required: ['source', 'acknowledgement', 'pageNumber', 'reason']
                        },
                    },
                },
            });
            
            const jsonText = response.text.trim();
            if (!jsonText) {
                return [];
            }

            const flaggedRecords = JSON.parse(jsonText) as AIFlaggedRecord[];
            return flaggedRecords;

        } catch (error) {
            lastError = error;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('"status":"RESOURCE_EXHAUSTED"') || errorMessage.includes('"code":429')) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`AI analysis rate limit hit. Retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
                await sleep(delay);
            } else {
                console.error("Gemini AI analysis failed with a non-retriable error:", error);
                throw new Error("The AI analysis failed due to an unexpected error.");
            }
        }
    }

    console.error("Gemini AI analysis failed after multiple retries:", lastError);
    throw new Error("The AI data quality check failed, possibly due to API rate limits. Please try again later.");
};


export const describeImage = async (imageBase64: string, mimeType: string): Promise<string> => {
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType,
                },
            };

            const textPart = {
                text: "Describe the main subject of this image in one brief sentence.",
            };

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [imagePart, textPart] },
            });

            return response.text.trim();
        } catch (error) {
            lastError = error;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Check for rate limit error
            if (errorMessage.includes('"status":"RESOURCE_EXHAUSTED"') || errorMessage.includes('"code":429')) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                console.warn(`Rate limit hit. Retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
                await sleep(delay);
            } else {
                // Not a rate limit error, fail fast
                console.error("Gemini AI image description failed with a non-retriable error:", error);
                throw new Error("AI description failed due to an unexpected error.");
            }
        }
    }
    
    console.error("Gemini AI image description failed after multiple retries:", lastError);
    throw new Error("AI description failed due to API rate limits. Please wait and try again.");
};