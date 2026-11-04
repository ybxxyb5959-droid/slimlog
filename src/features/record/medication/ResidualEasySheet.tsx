import { BottomSheet } from "@/components/common/BottomSheet";
import { RESIDUAL_DISCLAIMER } from "@/components/common/Notice";
import { Button } from "@/components/ui/button";
import { curveTmaxHours } from "@/fixtures/medications.mock";
import {
  batemanAmount,
  kaFromTmax,
  LN2,
  tmaxFromRates,
} from "@/lib/pk/residual";
import type { Medication } from "@/types/domain";

/**
 * '그래프 쉽게 보기' — 한 번 맞았을 때 곡선 모양을 약마다 다르게 보여 준다.
 * 숫자는 그 약의 허가자료 값(반감기·최고 도달 시간)만 쓰고, 세로축은 높이 비교용(단위 없음).
 */
export function ResidualEasySheet({
  open,
  onClose,
  medication,
}: {
  open: boolean;
  onClose: () => void;
  medication: Medication;
}) {
  const half = medication.pk.halfLifeHours;
  const tmaxText = medication.pk.tmaxHours?.text;
  return (
    <BottomSheet
      open={open}
      onRequestClose={onClose}
      title="그래프 쉽게 보기"
      description={`${medication.ingredient}(${medication.name})를 한 번 맞았을 때의 모양이에요.`}
      footer={
        <Button size="lg" className="w-full" onClick={onClose}>
          확인
        </Button>
      }
    >
      <div className="space-y-4 pb-1">
        <dl className="space-y-1.5 text-[15px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold text-text">
              {medication.ingredient} 반감기
            </dt>
            <dd className="text-text-muted">
              {half?.text ?? "확인하지 못했어요"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold text-text">최고 수준 도달</dt>
            <dd className="text-text-muted">
              {tmaxText ?? "확인하지 못했어요"}
            </dd>
          </div>
        </dl>

        {half ? (
          <EasyCurve medication={medication} />
        ) : (
          <p className="rounded-2xl bg-surface-muted px-4 py-3 text-[13px] text-text-muted">
            반감기 자료를 확인하지 못한 약이라 곡선을 그리지 않아요.
          </p>
        )}

        <section className="rounded-2xl bg-surface-muted px-4 py-3.5">
          <h3 className="text-[14px] font-bold text-text">반감기란?</h3>
          <p className="mt-1 text-[13px] leading-relaxed break-keep text-text-muted">
            몸속 약물이 절반으로 줄어드는 데 걸리는 시간이에요. 반감기가 길수록
            몸에 오래 머물러요. 반감기가 지나면 절반, 한 번 더 지나면 그
            절반(처음의 1/4)이 남는 식으로 줄어들어요.
          </p>
        </section>
        <section className="rounded-2xl bg-surface-muted px-4 py-3.5">
          <h3 className="text-[14px] font-bold text-text">그래프 읽는 법</h3>
          <ul className="mt-1 space-y-1 text-[13px] leading-relaxed break-keep text-text-muted">
            <li>· 맞은 직후엔 낮았다가 천천히 올라가 최고점에 닿아요.</li>
            <li>· 그 뒤로 반감기 속도로 내려가요.</li>
            <li>
              · 다음 투약이 남아 있는 양 위에 더해져서, 꾸준히 맞으면 곡선이
              계단처럼 쌓여요.
            </li>
          </ul>
        </section>
        {medication.id === "efpe" && (
          <p className="text-[12px] leading-relaxed text-text-subtle">
            에페글레나타이드는 한 번 투여 값이 없어 반복 투여(항정상태) 중앙값
            48시간으로 그렸어요.
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-text-subtle">
          {RESIDUAL_DISCLAIMER}
        </p>
      </div>
    </BottomSheet>
  );
}

/** 한 번 투여 곡선 그림 — 최고점·반감기 지점 표시 */
function EasyCurve({ medication }: { medication: Medication }) {
  const halfH = medication.pk.halfLifeHours!.value;
  const ke = LN2 / halfH;
  const tmax = curveTmaxHours(medication);
  const ka = tmax ? kaFromTmax(tmax, ke) : null;
  const amount = (h: number) =>
    ka ? batemanAmount(1, 1, ka, ke, h) : Math.exp(-ke * h);
  const tp = ka ? tmaxFromRates(ka, ke) : 0;
  const peak = amount(tp);
  // 최고점 뒤 절반이 되는 시점
  let th = tp;
  while (amount(th) > peak / 2 && th < tp + halfH * 4) th += 0.5;
  const end = th * 2;
  const W = 300;
  const H = 170;
  const L = 14;
  const B = 140;
  const T = 22;
  const x = (h: number) => L + (h / end) * (W - L - 8);
  const y = (v: number) => B - (v / peak) * (B - T);
  const pts = Array.from({ length: 121 }, (_, i) => (i / 120) * end).map(
    (h) => `${x(h).toFixed(1)},${y(amount(h)).toFixed(1)}`,
  );
  const days = (h: number) =>
    h < 48 ? `${Math.round(h)}시간` : `${Math.round((h / 24) * 10) / 10}일`;

  return (
    <figure className="rounded-2xl border border-border bg-surface px-3 pt-3 pb-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`한 번 맞은 뒤 약 ${days(tp)}에 최고점, 약 ${days(th)}에 최고점의 절반`}
      >
        <defs>
          <linearGradient id="easyFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--chart-residual)"
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor="var(--chart-residual)"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        <line
          x1={L}
          y1={B}
          x2={W - 6}
          y2={B}
          className="stroke-border"
          strokeWidth="1.5"
        />
        <line
          x1={L}
          y1={T - 8}
          x2={L}
          y2={B}
          className="stroke-border"
          strokeWidth="1.5"
        />
        <polygon
          points={`${x(0)},${B} ${pts.join(" ")} ${x(end)},${B}`}
          fill="url(#easyFill)"
        />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="var(--chart-residual)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* 최고점 */}
        <line
          x1={x(tp)}
          y1={y(peak)}
          x2={x(tp)}
          y2={B}
          className="stroke-primary"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <line
          x1={L}
          y1={y(peak)}
          x2={x(tp)}
          y2={y(peak)}
          className="stroke-text-subtle"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <circle
          cx={x(tp)}
          cy={y(peak)}
          r="5"
          className="fill-primary stroke-surface"
          strokeWidth="2"
        />
        <text
          x={x(tp)}
          y={y(peak) - 9}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          className="fill-text"
        >
          최고 수준
        </text>
        {/* 반감기 지점 */}
        <line
          x1={x(th)}
          y1={y(peak / 2)}
          x2={x(th)}
          y2={B}
          className="stroke-primary"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <line
          x1={L}
          y1={y(peak / 2)}
          x2={x(th)}
          y2={y(peak / 2)}
          className="stroke-text-subtle"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <circle
          cx={x(th)}
          cy={y(peak / 2)}
          r="5"
          className="fill-primary stroke-surface"
          strokeWidth="2"
        />
        <text
          x={x(th) + 8}
          y={y(peak / 2) - 8}
          fontSize="11"
          fontWeight="700"
          className="fill-text"
        >
          절반으로 줄어듦
        </text>
        {/* 시간 축 */}
        <text
          x={x(tp)}
          y={B + 16}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          className="fill-text"
        >
          {days(tp)}
        </text>
        <text
          x={x(th)}
          y={B + 16}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          className="fill-text"
        >
          {days(th)}
        </text>
        <text
          x={W - 8}
          y={B + 16}
          textAnchor="end"
          fontSize="10"
          className="fill-text-subtle"
        >
          시간 →
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-[12px] text-text-subtle">
        맞은 날을 0으로 둔 그림이에요 · 높이는 최고점 대비
      </figcaption>
    </figure>
  );
}
