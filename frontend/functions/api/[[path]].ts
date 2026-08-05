import app from '../../../backend/src/worker';

export const onRequest: PagesFunction = (context) => {
  return app.fetch(context.request, context.env, context as any);
};
