import { CircleAlert, Plus, Search, Star } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { amountLabel, fmtG, nutrientsFor, type NutrientTotals } from '@/lib/nutrition'
import { cn } from '@/lib/utils'
import { searchFoods, SEARCH_EXAMPLES } from '@/services/foodCatalog'
import { useMealStore } from '@/stores/mealStore'
import type { FoodItem, Nutrients } from '@/types/meal'

/* ---------------- 섭취량 편집 ---------------- */
const SERVINGS = [0.5, 1, 1.5, 2]

/** 1인분 배수 · 제품 단위 · g 직접 입력 — 바꾸면 영양 값을 즉시 다시 계산 */
export function AmountEditor({ food, grams, onChange }: { food: FoodItem; grams: number; onChange: (g: number) => void }) {
  const [text, setText] = useState(String(grams))
  const set = (g: number) => {
    const v = Math.round(g)
    setText(String(v))
    onChange(v)
  }
  const n = nutrientsFor(food, grams)
  const typed = Number(text)
  const invalid = !text || !Number.isFinite(typed) || typed <= 0 || typed > 5000

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[13px] font-medium text-text-muted">
          빠른 선택 <span className="text-text-subtle">· 1인분 = {food.servingGrams}g</span>
        </p>
        <div role="radiogroup" aria-label="인분 선택" className="grid grid-cols-4 gap-2">
          {SERVINGS.map((s) => {
            const g = Math.round(food.servingGrams * s)
            const active = grams === g
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set(g)}
                className={cn('h-11 rounded-xl border text-[14px] font-medium', active ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted')}
              >
                {s}인분
              </button>
            )
          })}
        </div>
      </div>
      {food.units && food.units.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-text-muted">제품 단위</p>
          <div className="flex flex-wrap gap-2">
            {food.units.flatMap((u) =>
              [1, 2, 3].map((k) => {
                const g = u.grams * k
                const label = u.label.replace(/^1/, String(k))
                return (
                  <button
                    key={`${u.label}-${k}`}
                    type="button"
                    aria-pressed={grams === g}
                    onClick={() => set(g)}
                    className={cn('h-10 rounded-full border px-4 text-[14px]', grams === g ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted')}
                  >
                    {label}
                  </button>
                )
              }),
            )}
          </div>
        </div>
      )}
      <div>
        <label htmlFor="gramsInput" className="mb-2 block text-[13px] font-medium text-text-muted">
          직접 입력
        </label>
        <div className="relative">
          <Input
            id="gramsInput"
            inputMode="numeric"
            value={text}
            aria-invalid={invalid}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '')
              setText(v)
              const num = Number(v)
              if (v && num > 0 && num <= 5000) onChange(num)
            }}
            className="tabular pr-10 text-[17px]"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-muted">g</span>
        </div>
        {invalid && <p className="mt-1.5 text-[13px] text-danger">1~5,000g 사이로 입력해 주세요.</p>}
      </div>
      <NutritionGrid n={n} caption={`섭취량 ${grams}g 기준 · 영양 기준 ${food.basisLabel}`} />
    </div>
  )
}

/** 칼로리 + 탄단지 4칸 */
export function NutritionGrid({ n, caption, big }: { n: Nutrients | NutrientTotals; caption?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-muted p-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold">{big ? '총 섭취 열량' : '칼로리'}</span>
        <span className={cn('tabular font-bold text-primary', big ? 'text-[30px]' : 'text-[24px]')}>
          {n.kcal.toLocaleString()} <span className="text-[15px]">kcal</span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 text-center">
        {(
          [
            ['탄수화물', n.carbG],
            ['단백질', n.proteinG],
            ['지방', n.fatG],
          ] as const
        ).map(([l, v]) => (
          <div key={l}>
            <dt className="text-[12px] text-text-muted">{l}</dt>
            <dd className={cn('tabular mt-0.5 font-bold', v === null ? 'text-[13px] text-text-subtle' : 'text-[18px]')}>{fmtG(v)}</dd>
          </div>
        ))}
      </dl>
      {'incomplete' in n && n.incomplete && (
        <p className="mt-2 flex items-center gap-1 text-[12px] text-review">
          <CircleAlert size={13} strokeWidth={1.75} aria-hidden /> 영양 정보가 없는 음식이 있어 실제보다 적게 보일 수 있어요
        </p>
      )}
      {caption && <p className="mt-2 text-[12px] text-text-subtle">{caption}</p>}
    </div>
  )
}

/* ---------------- 음식 검색 ---------------- */
export function FoodResultRow({ food, onPick, quickAdd }: { food: FoodItem; onPick: () => void; quickAdd?: () => void }) {
  const favorites = useMealStore((s) => s.favorites)
  const toggleFavorite = useMealStore((s) => s.toggleFavorite)
  const fav = favorites.includes(food.id)
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPick} className="flex min-h-[60px] min-w-0 flex-1 flex-col justify-center rounded-xl px-1 py-2 text-left hover:bg-surface-muted/60">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{food.name}</span>
          {food.custom && <span className="shrink-0 rounded bg-icon-soft px-1.5 text-[11px] font-medium text-icon">내 음식</span>}
        </span>
        <span className="tabular truncate text-[12px] text-text-muted">
          {food.brand ? `${food.brand} · ` : ''}
          {food.basisLabel} {food.kcal}kcal · 단백질 {fmtG(food.proteinG)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => toggleFavorite(food.id)}
        aria-pressed={fav}
        aria-label={`${food.name} 즐겨찾기 ${fav ? '해제' : '추가'}`}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
      >
        <Star size={18} strokeWidth={1.75} className={fav ? 'fill-review text-review' : 'text-text-subtle'} aria-hidden />
      </button>
      {quickAdd && (
        <button type="button" onClick={quickAdd} aria-label={`${food.name} 1인분 바로 추가`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft">
          <Plus size={20} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  )
}

/** 검색창 + 결과 + 결과 없음(직접 등록) */
export function FoodSearchPanel({
  onPick,
  onQuickAdd,
  onCreateCustom,
  autoFocus,
  initialQuery = '',
  compact,
}: {
  onPick: (food: FoodItem) => void
  onQuickAdd?: (food: FoodItem) => void
  onCreateCustom: (name: string) => void
  autoFocus?: boolean
  initialQuery?: string
  compact?: boolean
}) {
  const [q, setQ] = useState(initialQuery)
  useMealStore((s) => s.customFoods) // 내 음식 등록 시 다시 그리기
  const results = searchFoods(q)
  return (
    <div className="space-y-3">
      <div className="relative">
        <AppIcon icon={Search} size="sm" tone="muted" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="음식명 또는 제품명을 검색해보세요."
          aria-label="음식 검색"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className="h-12 rounded-full pl-11"
        />
      </div>
      {!q.trim() ? (
        <div className="flex flex-wrap gap-1.5" aria-label="검색 예시">
          {SEARCH_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setQ(ex)} className="h-9 rounded-full bg-surface-muted px-3.5 text-[13px] text-text-muted hover:text-text">
              {ex}
            </button>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-7 text-center">
          <p className="text-[15px] font-semibold">찾으시는 음식이 없나요?</p>
          <p className="mt-1 text-[13px] text-text-muted">‘{q.trim()}’ 영양 정보를 직접 등록하면 다음부터 검색돼요.</p>
          <Button variant="outline" className="mt-4" onClick={() => onCreateCustom(q.trim())}>
            직접 음식 등록하기
          </Button>
        </div>
      ) : (
        <ul className={cn('divide-y divide-border', compact && 'max-h-80 overflow-y-auto')} aria-label="검색 결과">
          {results.map((f) => (
            <li key={f.id}>
              <FoodResultRow food={f} onPick={() => onPick(f)} quickAdd={onQuickAdd ? () => onQuickAdd(f) : undefined} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-text-subtle">영양 값은 목업 예시예요. 실제 제품·식약처 DB 수치가 아니에요.</p>
    </div>
  )
}

/* ---------------- 직접 음식 등록 ---------------- */
export function CustomFoodForm({ initialName = '', onSaved }: { initialName?: string; onSaved: (food: FoodItem) => void }) {
  const addCustomFood = useMealStore((s) => s.addCustomFood)
  const [f, setF] = useState({ name: initialName, grams: '', unit: '', kcal: '', carb: '', protein: '', fat: '' })
  const [touched, setTouched] = useState(false)
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  const bad = (v: string, required: boolean) => (v.trim() === '' ? required : !(Number(v) >= 0 && Number(v) < 10000))
  const errors = {
    name: !f.name.trim() ? '음식명을 입력해 주세요.' : null,
    grams: bad(f.grams, true) || Number(f.grams) <= 0 ? '기준 제공량(g)을 입력해 주세요.' : null,
    kcal: bad(f.kcal, true) ? '칼로리를 입력해 주세요.' : null,
    carb: bad(f.carb, false) ? '숫자만 입력해 주세요.' : null,
    protein: bad(f.protein, false) ? '숫자만 입력해 주세요.' : null,
    fat: bad(f.fat, false) ? '숫자만 입력해 주세요.' : null,
  }
  const ok = Object.values(errors).every((e) => !e)
  const field = (key: keyof typeof f, label: string, opts: { unit?: string; required?: boolean; placeholder?: string; numeric?: boolean } = {}) => (
    <div>
      <label htmlFor={`custom-${key}`} className="mb-1.5 block text-[13px] font-medium text-text-muted">
        {label} {opts.required ? <span className="text-danger">*</span> : <span className="text-text-subtle">(선택)</span>}
      </label>
      <div className="relative">
        <Input
          id={`custom-${key}`}
          value={f[key]}
          inputMode={opts.numeric ? 'decimal' : undefined}
          placeholder={opts.placeholder}
          aria-invalid={touched && !!errors[key as keyof typeof errors]}
          onChange={(e) => setF((s) => ({ ...s, [key]: e.target.value }))}
          className={opts.unit ? 'pr-12' : ''}
        />
        {opts.unit && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-text-muted">{opts.unit}</span>}
      </div>
      {touched && errors[key as keyof typeof errors] && <p className="mt-1 text-[12px] text-danger">{errors[key as keyof typeof errors]}</p>}
    </div>
  )
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!ok) return
        const grams = Number(f.grams)
        const food = addCustomFood({
          name: f.name.trim(),
          basisGrams: grams,
          basisLabel: f.unit.trim() ? `${f.unit.trim()}(${grams}g)당` : `${grams}g당`,
          servingGrams: grams,
          units: f.unit.trim() ? [{ label: `1${f.unit.trim().replace(/^1/, '')}`, grams }] : undefined,
          kcal: Number(f.kcal),
          carbG: num(f.carb),
          proteinG: num(f.protein),
          fatG: num(f.fat),
        })
        onSaved(food)
      }}
    >
      {field('name', '음식명', { required: true, placeholder: '예: 엄마표 잡곡밥' })}
      <div className="grid grid-cols-2 gap-3">
        {field('grams', '기준 제공량', { required: true, unit: 'g', numeric: true, placeholder: '210' })}
        {field('unit', '단위 이름', { placeholder: '예: 1공기, 1개' })}
      </div>
      {field('kcal', '칼로리', { required: true, unit: 'kcal', numeric: true })}
      <div className="grid grid-cols-3 gap-2">
        {field('carb', '탄수화물', { unit: 'g', numeric: true })}
        {field('protein', '단백질', { unit: 'g', numeric: true })}
        {field('fat', '지방', { unit: 'g', numeric: true })}
      </div>
      <p className="text-[12px] leading-relaxed text-text-subtle">영양소를 비워 두면 0g이 아니라 ‘정보 없음’으로 저장돼요. 등록한 음식은 내 음식 목록에만 보여요 (목업).</p>
      <Button type="submit" size="lg" className="w-full">
        내 음식으로 등록
      </Button>
    </form>
  )
}

/* ---------------- 섭취량 수정 시트 ---------------- */
export function AmountSheet({ food, grams, open, onClose, onApply }: { food: FoodItem | undefined; grams: number; open: boolean; onClose: () => void; onApply: (g: number) => void }) {
  const [g, setG] = useState(grams)
  if (!food) return null
  return (
    <BottomSheet
      open={open}
      onRequestClose={onClose}
      title={`${food.name} 섭취량`}
      description={food.brand}
      footer={
        <Button size="lg" className="w-full" onClick={() => onApply(g)} disabled={!(g > 0)}>
          {amountLabel(g, food)}로 바꾸기
        </Button>
      }
    >
      <AmountEditor food={food} grams={g} onChange={setG} />
    </BottomSheet>
  )
}
