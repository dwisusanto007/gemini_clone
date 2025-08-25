import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server API key not set' }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const { prompt, attachments } = await req.json();
    // attachments: [{ type, content, name }]
    let model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let parts: any[] = [prompt];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.type && att.type.startsWith('image/') && att.content) {
          parts.push({
            inlineData: {
              mimeType: att.type,
              data: att.content,
            },
          });
        } else if (att.type === 'application/pdf' && att.content) {
          parts[0] += `\n\nKonten PDF \"${att.name}\":\n${att.content}`;
        }
      }
    }
    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = await response.text();
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
