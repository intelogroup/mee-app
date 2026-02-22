'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-black text-white">
        <div className="flex h-screen flex-col items-center justify-center p-6">
          <h2 className="text-3xl font-black mb-4 text-red-500 tracking-tighter">SYSTEM FAILURE</h2>
          <p className="text-gray-400 mb-8 font-mono text-sm max-w-md text-center border border-red-900/30 p-4 rounded bg-red-900/10">
            Critical error in root layout.
            <br/><br/>
            {error.message}
          </p>
          <button
            onClick={() => reset()}
            className="px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
          >
            REBOOT SYSTEM
          </button>
        </div>
      </body>
    </html>
  );
}
