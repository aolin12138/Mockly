export default function AmbientBackground() {
  return (
    <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      {/* Light gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_40%,#eef2f7_100%)] dark:opacity-0 transition-opacity duration-500" />
      {/* Dark gradient */}  
      <div className="absolute inset-0 bg-slate-950 opacity-0 dark:opacity-100 transition-opacity duration-500" />
      
      {/* Blur orbs */}
      <div className="absolute top-[-8%] left-[8%] w-[32rem] h-[32rem] bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="absolute top-[8%] right-[-6%] w-[28rem] h-[28rem] bg-sky-500/10 rounded-full blur-[130px]" />
      <div className="absolute bottom-[-15%] left-[20%] w-[34rem] h-[28rem] bg-amber-500/5 rounded-full blur-[150px]" />
      <div className="absolute top-[40%] right-[10%] w-[20rem] h-[20rem] bg-purple-500/5 rounded-full blur-[120px]" />
    </div>
  );
}
