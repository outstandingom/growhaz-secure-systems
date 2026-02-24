export const FloatingInvestButton = () => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      <a
        href="https://rzp.io/rzp/Growhaz-funding"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] focus:outline-none"
        aria-label="Invest in Growhaz"
      >
        {/* Indian Rupee (₹) SVG Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3h12" />
          <path d="M6 8h12" />
          <path d="m6 13 8.5 8" />
          <path d="M6 13h3" />
          <path d="M9 13c6.667 0 6.667-10 0-10" />
        </svg>
      </a>
      
      {/* Dark theme label with cyan border */}
      <span className="text-xs font-semibold tracking-wide text-cyan-50 bg-[#0B1120]/90 border border-cyan-500/30 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md">
        Invest in Growhaz
      </span>
    </div>
  );
};
