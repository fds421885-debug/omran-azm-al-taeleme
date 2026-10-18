process.env.NETLIFY = 'true';
import serverless from 'serverless-http';
import { app } from '../../server.ts';

const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // Instant response for CORS preflight in Netlify serverless
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-gemini-api-key',
      },
      body: '',
    };
  }

  try {
    const res = await serverlessHandler(event, context);
    return res;
  } catch (err: any) {
    console.error('[Netlify Function api] Unhandled serverless execution error:', err);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        reply: 'أهلاً بك يا أخي الكريم. تم استقبال طلبك ولكن حدث تأخر عابر في استجابة الخادم. تفضل بإعادة إرسال طلبك وسأخدمك فوراً.',
        action: null,
      }),
    };
  }
};
