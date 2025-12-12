import { GoogleGenAI, Type } from "@google/genai";
import { GeminiExerciseResponse } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCbtExercise = async (symptoms: string): Promise<GeminiExerciseResponse | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Actúa como un terapeuta experto en Terapia Cognitivo Conductual (TCC). 
      Genera un ejercicio práctico, breve y específico para un paciente que presenta los siguientes síntomas: "${symptoms}".
      El ejercicio debe ser claro y seguir una estructura paso a paso.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Un título alentador y claro para el ejercicio" },
            description: { type: Type.STRING, description: "Una breve explicación de por qué este ejercicio ayuda con los síntomas mencionados" },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de pasos prácticos a seguir (entre 3 y 5 pasos)",
            },
          },
          required: ["title", "description", "steps"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiExerciseResponse;
    }
    return null;

  } catch (error) {
    console.error("Error generating CBT exercise:", error);
    return null;
  }
};