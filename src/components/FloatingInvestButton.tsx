export const FloatingInvestButton = () => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      <a
        href="https://rzp.io/rzp/Growhaz-funding"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:bg-emerald-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-300"
        aria-label="Invest in Growhaz"
      >
        {/* A simple standard currency/investment icon (SVG) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      </a>
      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 bg-white/80 dark:bg-black/80 px-2 py-1 rounded-md shadow-sm backdrop-blur-sm">
        Invest in Growhaz
      </span>
    </div>
  );
};
