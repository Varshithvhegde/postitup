import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://1c3dcba660ae52cd2b2fb9d9b3965603@o4511539967229952.ingest.us.sentry.io/4511539974307840",
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: false,
});
