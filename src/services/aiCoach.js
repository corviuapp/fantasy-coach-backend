import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function getCoachAdvice(question) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a friendly fantasy football NFL coach. CRITICAL: Always respond in the SAME LANGUAGE as the user question. If they write in Spanish, respond in Spanish. If they write in English, respond in English. If they write in any other language, respond in that language. Give advice in 2-3 sentences, casual tone, be specific and actionable. For Spanish responses, use NFL terms but explain in Spanish.'
        },
        {
          role: 'user',
          content: question
        }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 150
    });
    
    return completion.choices[0]?.message?.content || 'Let me think about that...';
  } catch (error) {
    console.error('Groq error:', error);
    return 'Sorry, having trouble connecting to my brain. Try again!';
  }
}

export default { getCoachAdvice };