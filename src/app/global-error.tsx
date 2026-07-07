"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", gap:"1rem", fontFamily:"sans-serif" }}>
      <h1 style={{ fontSize:"1.5rem", color:"#374151" }}>حدث خطأ</h1>
      <button type="button" onClick={reset} style={{ color:"#2563eb", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
        حاول مرة أخرى
      </button>
    </div>
  );
}
