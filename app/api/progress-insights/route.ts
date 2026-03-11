import { NextResponse } from "next/server";
import { openai } from "@/lib/ai/client";

export async function POST(req: Request) {
  try {
    const metrics = await req.json();

    if (!metrics || typeof metrics !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a motivating fitness coach for a workout app. Use only the provided metrics. Do not invent data. Be concise, realistic, useful, and encouraging. Return output that matches the schema exactly.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(metrics),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "progress_insights",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              heroHeadline: { type: "string" },
              heroSummary: { type: "string" },
              topWin: { type: "string" },
              topConcern: { type: "string" },
              nextBestMove: { type: "string" },
              volumeCallout: { type: "string" },
              bodyPartCallout: { type: "string" },
            },
            required: [
              "heroHeadline",
              "heroSummary",
              "topWin",
              "topConcern",
              "nextBestMove",
              "volumeCallout",
              "bodyPartCallout",
            ],
          },
        },
      },
    });

    const outputText = response.output_text;

    if (!outputText) {
      return NextResponse.json(
        { error: "Model returned an empty response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("progress-insights route error:", error);

    return NextResponse.json(
      { error: "Failed to generate progress insights" },
      { status: 500 }
    );
  }
}