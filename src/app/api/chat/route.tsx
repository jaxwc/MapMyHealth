import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are MapMyHealth, a helpful medical AI assistant.
    Based on the user's symptoms, provide a conversational response and a detailed analysis.

    1.  **knowns**: List key facts and symptoms extracted directly from the user's input.
    2.  **unknowns**: List critical follow-up questions you would need to ask for a better diagnosis.
    3.  **conditions**: List the top 3 **most likely** potential conditions. For each, provide a "name" and a brief one-sentence "description".
    4.  **treatments**: List 2-3 common, general treatment suggestions or next steps.

    ALWAYS respond with a valid JSON object in the following format, and nothing else:
    {
      "responseText": "A conversational and helpful response for the user.",
      "analysis": {
        "knowns": ["Fact from prompt", "Symptom from prompt"],
        "unknowns": ["Follow-up question 1?", "Follow-up question 2?"],
        "conditions": [
          { "name": "Condition A", "description": "A brief, one-sentence explanation." },
          { "name": "Condition B", "description": "A brief, one-sentence explanation." },
          { "name": "Condition C", "description": "A brief, one-sentence explanation." }
        ],
        "treatments": ["General treatment suggestion 1", "Next step to take"]
      }
    }

    User symptoms: "${prompt}"`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();

    const startIndex = responseText.indexOf("{");
    const endIndex = responseText.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1) {
      throw new Error("Could not find JSON object in the response.");
    }

    const jsonString = responseText.substring(startIndex, endIndex + 1);
    const data = JSON.parse(jsonString);

    return NextResponse.json(data);
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Failed to process AI response." },
      { status: 500 }
    );
  }
}