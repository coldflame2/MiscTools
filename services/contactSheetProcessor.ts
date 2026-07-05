import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedImage } from '../types';

// Per esm.sh and pdf.js documentation for ES modules, set the worker source on the library's namespace.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs';


const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const processDocx = async (file: File): Promise<ExtractedImage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.getElementsByTagName('img');
    const extracted: ExtractedImage[] = [];

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const src = img.src;
        if (src.startsWith('data:')) {
            const [header, base64] = src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            
            // Heuristic: Find associated text by looking at the next sibling element
            let associatedText = 'Page number not found';
            const nextElement = img.parentElement?.nextElementSibling;
            if (nextElement) {
                associatedText = nextElement.textContent || '';
            }
            
            extracted.push({
                imageBase64: base64,
                mimeType,
                associatedText,
            });
        }
    }
    return extracted;
};

const processPdf = async (file: File): Promise<ExtractedImage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const extracted: ExtractedImage[] = [];

    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            try {
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');

                const operatorList = await page.getOperatorList();

                for (let j = 0; j < operatorList.fnArray.length; j++) {
                    if (operatorList.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                        const imgKey = operatorList.argsArray[j][0];
                        try {
                            // Fix: In modern pdf.js versions (v3+), `page.getResources()` is removed.
                            // To extract images without rendering to a canvas, we must access an internal
                            // API `page.objs` to get the image data stream by its key. This returns a promise.
                            const imgData = await (page as any).objs.get(imgKey);
                            
                            if (imgData && imgData.data) {
                                const imageBuffer = imgData.data.buffer;
                                const base64 = arrayBufferToBase64(imageBuffer);
                                
                                // The object returned by objs.get has properties to help identify the image type.
                                const mimeType = imgData.isJpeg ? 'image/jpeg' : 'image/png';

                                extracted.push({
                                    imageBase64: base64,
                                    mimeType: mimeType,
                                    associatedText: pageText, // Associate all page text with each image
                                });
                            }
                        } catch (err) {
                            console.error(`Error processing image resource ${imgKey} on page ${i}:`, err);
                        }
                    }
                }
            } finally {
                // Ensure page resources are cleaned up to prevent memory leaks.
                page.cleanup();
            }
        }
    } finally {
        // Ensure the entire PDF document object is destroyed.
        if (pdf) {
            pdf.destroy();
        }
    }
    
    return extracted;
};


export const processContactSheet = async (file: File): Promise<ExtractedImage[]> => {
    if (file.type === 'application/pdf') {
        return processPdf(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return processDocx(file);
    } else {
        throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
    }
};