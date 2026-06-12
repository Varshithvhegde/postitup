"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryTestPage() {
  const [status, setStatus] = useState<string | null>(null);

  const show = (msg: string) => setStatus(msg);

  const triggerUnhandledError = () => {
    throw new Error("PostItUp Sentry test — unhandled render error");
  };

  const triggerCapturedError = () => {
    try {
      throw new Error("PostItUp Sentry test — manually captured error");
    } catch (e) {
      Sentry.captureException(e);
      show("✅ Captured exception sent to Sentry");
    }
  };

  const triggerMessage = () => {
    Sentry.captureMessage("PostItUp Sentry test — info message", "info");
    show("✅ Info message sent to Sentry");
  };

  const triggerMetrics = () => {
    Sentry.metrics.count("button_click", 1);
    Sentry.metrics.gauge("page_load_time", 150, { unit: "millisecond" });
    Sentry.metrics.distribution("response_time", 200, { unit: "millisecond" });
    show("✅ Metrics sent — count, gauge, distribution (check Sentry → Metrics)");
  };

  const triggerWithContext = () => {
    Sentry.withScope((scope) => {
      scope.setTag("test_type", "context_test");
      scope.setExtra("board_id", "test-board-123");
      scope.setUser({ id: "test-user-42", email: "test@postitup.com" });
      Sentry.captureMessage("PostItUp Sentry test — error with context", "error");
    });
    show("✅ Error with context (tags + user) sent to Sentry");
  };

  const triggerPromiseRejection = () => {
    Promise.reject(new Error("PostItUp Sentry test — unhandled promise rejection"));
    show("✅ Unhandled promise rejection triggered (check Sentry)");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-amber-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-800">🔍 Sentry Test Page</h1>
        <p className="text-sm text-gray-500">
          Use these buttons to send test events to your Sentry dashboard.
          <br />
          <strong>Remove this page before going to production.</strong>
        </p>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={triggerCapturedError}
            className="rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-4 py-2 text-sm text-left"
          >
            🐛 Captured exception (safe — won't crash page)
          </button>

          <button
            onClick={triggerMessage}
            className="rounded-lg bg-green-100 hover:bg-green-200 text-green-800 font-medium px-4 py-2 text-sm text-left"
          >
            💬 Info message
          </button>

          <button
            onClick={triggerMetrics}
            className="rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium px-4 py-2 text-sm text-left"
          >
            📊 Send metrics (count + gauge + distribution)
          </button>

          <button
            onClick={triggerWithContext}
            className="rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-medium px-4 py-2 text-sm text-left"
          >
            🏷️ Error with tags + user context
          </button>

          <button
            onClick={triggerPromiseRejection}
            className="rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium px-4 py-2 text-sm text-left"
          >
            ⚡ Unhandled promise rejection
          </button>

          <button
            onClick={triggerUnhandledError}
            className="rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-medium px-4 py-2 text-sm text-left"
          >
            💥 Unhandled render error (will crash + show global-error UI)
          </button>
        </div>

        {status && (
          <div className="mt-2 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
            {status}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Check your Sentry dashboard at{" "}
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            sentry.io
          </a>{" "}
          — events appear within a few seconds.
        </p>
      </div>
    </main>
  );
}
