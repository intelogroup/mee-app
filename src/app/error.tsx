'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h2 className="text-2xl font-bold mb-4 text-red-500">Something went wrong!</h2>
      <p className="text-gray-400 mb-8 max-w-md text-center">
        {error.message || "An unexpected error occurred. Mee has been notified."}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-6 py-2 border border-white/20 text-white font-bold rounded-lg hover:bg-white/10 transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
