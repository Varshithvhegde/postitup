"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-amber-50 font-sans">
        <h2 className="text-xl font-bold text-gray-800">Something went wrong</h2>
        <button
          onClick={reset}
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-500"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
