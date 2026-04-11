export default function AmbientBackground() {
  return (
    <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_40%,#eef2f7_100%)]" />
      <div className="absolute top-[-8%] left-[8%] w-[32rem] h-[32rem] bg-emerald-200/30 rounded-full blur-[140px]" />
      <div className="absolute top-[8%] right-[-6%] w-[28rem] h-[28rem] bg-sky-200/35 rounded-full blur-[130px]" />
      <div className="absolute bottom-[-15%] left-[20%] w-[34rem] h-[28rem] bg-amber-100/40 rounded-full blur-[150px]" />
    </div>
  );
}
