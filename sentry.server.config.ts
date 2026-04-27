// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

/**
 * Scrubs sensitive data from events before sending to Sentry
 */
function beforeSend(event: Sentry.ErrorEvent, _hint: Sentry.EventHint): Sentry.ErrorEvent | null {
  // Scrub sensitive headers
  if (event.request?.headers) {
    delete event.request.headers.cookie;
    delete event.request.headers.authorization;
    delete event.request.headers.Cookie;
    delete event.request.headers.Authorization;
  }

  // Remove user IP and sensitive user fields
  if (event.user) {
    event.user.ip_address = null;
    delete event.user.email;
  }

  return event;
}

/**
 * Scrubs sensitive data from logs before sending to Sentry
 */
function beforeSendLog(log: Sentry.Log): Sentry.Log | null {
  // Remove any sensitive data from log attributes
  if (log.attributes) {
    delete log.attributes.password;
    delete log.attributes.token;
    delete log.attributes.apiKey;
    delete log.attributes.secret;
  }

  return log;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Disable sending user PII (Personally Identifiable Information) by default
  // Only enable in non-production environments when explicitly approved
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: process.env.NODE_ENV !== "production",

  // Scrub sensitive data before sending events
  beforeSend,

  // Scrub sensitive data before sending logs
  beforeSendLog,
});
