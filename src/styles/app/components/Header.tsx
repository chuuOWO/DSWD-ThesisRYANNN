export function Header() {
  return (
    <div className="bg-blue-700 h-16 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg" 
          alt="DSWD Seal" 
          className="h-14 w-auto drop-shadow-lg" 
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center ring-2 ring-blue-500/30">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <span className="text-white text-sm font-medium">novrindept@swsu.com</span>
      </div>
    </div>
  );
}
