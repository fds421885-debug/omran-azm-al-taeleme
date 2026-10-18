process.env.NETLIFY = 'true';
import serverless from 'serverless-http';
import { app } from '../../server.ts';

const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  return await serverlessHandler(event, context);
};
