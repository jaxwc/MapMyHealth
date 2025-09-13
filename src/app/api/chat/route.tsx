import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = 'edge';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are a helpful medical assistant. Based on the user's symptoms, provide a conversational response and a list of 3-5 potential conditions.
    ALWAYS respond with a valid JSON object in the following format, and nothing else:
    {
      "responseText": "A conversational and helpful response for the user.",
      "conditions": ["Condition A", "Condition B", "Condition C"]
    }

    User symptoms: "${prompt}"`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();


    console.log("Raw Gemini Response:", responseText);


    const startIndex = responseText.indexOf('{');
    const endIndex = responseText.lastIndexOf('}');

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