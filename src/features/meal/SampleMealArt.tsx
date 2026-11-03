/** 예시 사진 대신 쓰는 한 상 차림 일러스트 (실제 사진 아님) — 4:3 */
export function SampleMealArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="예시 한 상 차림 그림: 찌개, 밥, 반찬 세 가지">
      <rect width="400" height="300" fill="#e9e2d6" />
      <rect x="24" y="20" width="352" height="260" rx="22" fill="#d7c7ae" />
      {/* 찌개 */}
      <circle cx="120" cy="105" r="62" fill="#3b3b3b" />
      <circle cx="120" cy="105" r="52" fill="#c4471f" />
      <circle cx="104" cy="92" r="11" fill="#f2e6c9" />
      <circle cx="136" cy="116" r="9" fill="#f2e6c9" />
      <rect x="108" y="112" width="18" height="8" rx="3" fill="#7a9a3a" />
      {/* 밥 */}
      <circle cx="270" cy="100" r="52" fill="#f7f7f5" stroke="#cfc9bd" strokeWidth="4" />
      <circle cx="270" cy="100" r="40" fill="#ffffff" />
      <circle cx="258" cy="92" r="3" fill="#ece9e1" />
      <circle cx="282" cy="108" r="3" fill="#ece9e1" />
      {/* 반찬 3 */}
      <ellipse cx="92" cy="222" rx="50" ry="36" fill="#f5f2ea" stroke="#cfc9bd" strokeWidth="3" />
      <path d="M62 222c10-14 24-18 30-6s20 2 30-4c-4 16-18 22-30 18s-22 4-30-8z" fill="#3f7a2b" />
      <ellipse cx="202" cy="228" rx="50" ry="36" fill="#f5f2ea" stroke="#cfc9bd" strokeWidth="3" />
      <rect x="172" y="214" width="24" height="26" rx="6" fill="#f2c94c" />
      <rect x="200" y="212" width="24" height="26" rx="6" fill="#f2c94c" />
      <path d="M176 222h16M204 220h16" stroke="#e0a82e" strokeWidth="3" />
      <ellipse cx="312" cy="222" rx="50" ry="36" fill="#f5f2ea" stroke="#cfc9bd" strokeWidth="3" />
      <path d="M284 218c8-12 22-14 30-4s20 0 26 6c-6 14-22 18-32 12s-20 0-24-14z" fill="#c8402a" />
    </svg>
  )
}
