#!/usr/bin/env python3
"""
식약처 식품영양성분 표준데이터(CSV) → SlimLog 공용 음식(foods) 가져오기

받는 곳: 공공데이터포털(data.go.kr) 「전국통합식품영양성분정보(음식)표준데이터」 CSV 다운로드
         (또는 식품의약품안전처 식품영양성분 데이터베이스 엑셀을 CSV 로 저장)

컬럼 이름은 배포판마다 조금씩 달라서, 후보 이름 목록으로 찾는다.
못 찾은 필수 컬럼이 있으면 아무것도 만들지 않고 어떤 컬럼이 있는지 알려준다 (--map 으로 직접 지정 가능).

사용
  # 1) 미리보기 — 몇 개가 어떻게 바뀌는지만 본다
  python3 scripts/foods/import_foods.py data.csv --dry-run
  # 2) SQL 파일 만들기 — Supabase SQL Editor 에 붙여넣기 (파일이 크면 --chunk 로 나눔)
  python3 scripts/foods/import_foods.py data.csv --out foods_seed.sql
  # 3) 또는 서버 키로 바로 넣기 (내 PC 에서만, 키는 환경변수로)
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/foods/import_foods.py data.csv --rest

원칙
  - 원본 값을 그대로 옮긴다. 빈 칸·'-' 은 null(정보 없음)로 두고 0 으로 바꾸지 않는다.
  - 출처(data_source)에 파일 이름을 남긴다.
  - 같은 식품코드는 다시 넣으면 갱신된다 (food_id = 'mfds-' + 식품코드).

표준 라이브러리만 사용.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

CANDIDATES: dict[str, list[str]] = {
    "code": ["식품코드", "음식코드", "FOOD_CD", "food_code"],
    "name": ["식품명", "음식명", "FOOD_NM_KR", "food_name"],
    "group": ["식품대분류명", "대분류", "식품대분류", "FOOD_CAT1_NM"],
    "basis": ["영양성분함량기준량", "영양성분기준용량", "1회제공량기준", "SERVING_SIZE", "기준량"],
    "kcal": ["에너지(kcal)", "에너지(㎉)", "열량(kcal)", "AMT_NUM1", "에너지"],
    "protein": ["단백질(g)", "AMT_NUM3", "단백질"],
    "fat": ["지방(g)", "AMT_NUM4", "지방"],
    "carb": ["탄수화물(g)", "AMT_NUM6", "탄수화물"],
    "sodium": ["나트륨(mg)", "AMT_NUM13", "나트륨"],
    "serving": ["1회섭취참고량", "1회 섭취참고량", "식품중량", "총내용량", "1회제공량"],  # 음식 데이터는 '식품중량'이 1인분 무게
    "maker": ["제조사명", "업체명", "MAKER_NM"],
}
REQUIRED = ["code", "name", "kcal"]

# 식약처 대분류 → 앱 분류 (모르는 분류는 '일품')
GROUP_MAP = [
    (r"밥|죽|면|만두|국수|떡", "밥·면"),
    (r"국|탕|찌개|전골", "국·찌개"),
    (r"볶음|조림|구이|나물|무침|김치|젓갈|장아찌|전|부침|튀김|찜", "반찬"),
    (r"과일|과자|빵|떡|아이스|당류|간식|견과", "과일·간식"),
    (r"음료|차|커피|주스|우유|유제품", "음료"),
]


# 원재료 이름은 '닭고기_가슴(껍질 제거)_삶은것' 형태 → 사람들이 검색하는 말을 앞에 붙인다 (원래 이름은 그대로 뒤에 남김)
ALIASES = [
    (r"^닭고기_가슴", "닭가슴살"),
    (r"^닭고기_안심", "닭안심"),
    (r"^달걀", "계란"),
    (r"^돼지고기_안심", "돼지 안심"),
    (r"^쇠고기|^소고기", "소고기"),
    (r"^멥쌀_.*_현미", "현미"),
]


def display_name(raw: str) -> str:
    """'_' 구분 이름을 읽기 좋게: '닭고기_가슴(껍질 제거)_삶은것' → '닭가슴살 · 닭고기 가슴(껍질 제거) 삶은것'"""
    clean = re.sub(r"\s+", " ", raw.replace("_", " ")).strip()
    for pat, alias in ALIASES:
        if re.search(pat, raw) and alias not in clean:
            return f"{alias} · {clean}"
    return clean


@dataclass
class Row:
    food_id: str
    name: str
    brand: str | None
    category: str
    basis_grams: float
    basis_label: str
    serving_g: float
    kcal: float
    carb_g: float | None
    protein_g: float | None
    fat_g: float | None
    sodium_mg: float | None
    data_source: str


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit("파일 인코딩을 읽지 못했어요 (UTF-8 / CP949 가 아님)")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    return [h.strip() for h in (reader.fieldnames or [])], rows


def resolve_columns(headers: list[str], overrides: dict[str, str]) -> dict[str, str | None]:
    norm = {re.sub(r"\s+", "", h): h for h in headers}
    out: dict[str, str | None] = {}
    for key, cands in CANDIDATES.items():
        if key in overrides:
            out[key] = overrides[key] if overrides[key] in headers else None
            continue
        out[key] = next((norm[re.sub(r"\s+", "", c)] for c in cands if re.sub(r"\s+", "", c) in norm), None)
    return out


def num(v: str | None) -> float | None:
    """'12.3' → 12.3, '-'·''·'tr'(미량) → None. 쉼표 제거."""
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in ("", "-", "N/A", "NA") or s.lower() in ("tr", "trace"):
        return None
    m = re.match(r"^-?\d+(\.\d+)?", s)
    return float(m.group(0)) if m else None


def grams_of(v: str | None) -> float | None:
    """'100g' '100 g' '900g' '200ml' → 숫자 (ml 은 g 와 같게 본다)"""
    if v is None:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(g|ml|mL|그램)?", str(v).replace(",", ""))
    return float(m.group(1)) if m and float(m.group(1)) > 0 else None


def unit_of(v: str | None) -> str:
    """기준량 단위: 'ml' 또는 'g' (모르면 g)"""
    return "ml" if v and re.search(r"m[lL]|㎖", str(v)) else "g"


def category_of(group: str | None) -> str:
    g = group or ""
    for pat, cat in GROUP_MAP:
        if re.search(pat, g):
            return cat
    return "일품"


def convert(rows: list[dict[str, str]], cols: dict[str, str | None], source: str, dedupe_name: bool = False) -> tuple[list[Row], list[str]]:
    """dedupe_name: 같은 이름(·제조사)이 여러 번이면 처음 것만 — 출처가 달라 값이 조금씩 다른 중복 행 정리"""
    out: list[Row] = []
    skipped: list[str] = []
    seen: set[str] = set()
    seen_names: set[tuple[str, str]] = set()
    get = lambda r, k: (r.get(cols[k]) if cols.get(k) else None)  # noqa: E731
    # 같은 음식이 g 기준·mL(부피) 기준으로 섞여 있으면 g 기준을 먼저 본다 (앱은 그램으로 계산) — 원래 행 번호는 유지
    order = sorted(enumerate(rows, start=2), key=lambda x: unit_of(get(x[1], "basis")) == "ml") if dedupe_name else list(enumerate(rows, start=2))
    for i, r in order:
        code = (get(r, "code") or "").strip()
        name = (get(r, "name") or "").strip()
        kcal = num(get(r, "kcal"))
        if not code or not name:
            skipped.append(f"{i}행: 코드/이름 없음")
            continue
        if kcal is None:
            skipped.append(f"{i}행 {name}: 열량 없음")
            continue
        fid = f"mfds-{code}"
        if fid in seen:
            skipped.append(f"{i}행 {name}: 식품코드 중복")
            continue
        maker = (get(r, "maker") or "").strip()
        maker = "" if maker in ("해당없음", "-") else maker
        if dedupe_name:
            k = (name, maker)
            if k in seen_names:
                skipped.append(f"{i}행 {name}: 같은 이름 중복")
                continue
            seen_names.add(k)
        seen.add(fid)
        basis = grams_of(get(r, "basis")) or 100.0
        serving = grams_of(get(r, "serving")) or basis
        unit = unit_of(get(r, "basis"))
        out.append(
            Row(
                food_id=fid,
                name=display_name(name)[:40],
                brand=maker[:40] or None,
                category=category_of(get(r, "group")),
                basis_grams=basis,
                basis_label=f"{basis:g}g당" if unit == "g" else f"{basis:g}mL당(약 {basis:g}g)",
                serving_g=serving,
                kcal=kcal,
                carb_g=num(get(r, "carb")),
                protein_g=num(get(r, "protein")),
                fat_g=num(get(r, "fat")),
                sodium_mg=num(get(r, "sodium")),
                data_source=source,
            )
        )
    return out, skipped


def sql_literal(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(float(v)) if isinstance(v, float) else str(v)
    return "'" + str(v).replace("'", "''") + "'"


COLS = ["food_id", "name", "brand", "category", "basis_grams", "basis_label", "serving_g", "kcal", "carb_g", "protein_g", "fat_g", "sodium_mg", "data_source"]


def to_sql(rows: list[Row], batch: int = 500) -> str:
    parts = ["-- SlimLog 공용 음식 가져오기 (scripts/foods/import_foods.py 로 생성)", "begin;"]
    for i in range(0, len(rows), batch):
        chunk = rows[i : i + batch]
        values = ",\n".join("(" + ", ".join(sql_literal(getattr(r, c)) for c in COLS) + ")" for r in chunk)
        parts.append(
            f"insert into public.foods ({', '.join(COLS)}) values\n{values}\n"
            "on conflict (food_id) do update set "
            + ", ".join(f"{c} = excluded.{c}" for c in COLS if c != "food_id")
            + " where public.foods.owner_id is null;"
        )
    parts.append("commit;")
    return "\n".join(parts) + "\n"


def push_rest(rows: list[Row], url: str, key: str, batch: int = 500) -> int:
    sent = 0
    for i in range(0, len(rows), batch):
        body = json.dumps([{c: getattr(r, c) for c in COLS} for r in rows[i : i + batch]], ensure_ascii=False).encode()
        req = urllib.request.Request(
            f"{url.rstrip('/')}/rest/v1/foods?on_conflict=food_id",
            data=body,
            method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
        )
        with urllib.request.urlopen(req) as res:  # noqa: S310 (사용자가 지정한 Supabase 주소)
            if res.status >= 300:
                raise SystemExit(f"업로드 실패: HTTP {res.status}")
        sent += len(rows[i : i + batch])
    return sent


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="식약처 영양성분 CSV → SlimLog foods")
    ap.add_argument("csv", type=Path)
    ap.add_argument("--dry-run", action="store_true", help="변환 결과만 보여주고 아무것도 만들지 않음")
    ap.add_argument("--out", type=Path, help="SQL 파일로 저장")
    ap.add_argument("--chunk", type=int, default=0, help="SQL 을 N 행씩 여러 파일로 나눔 (SQL Editor 붙여넣기용)")
    ap.add_argument("--rest", action="store_true", help="SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경변수로 바로 업로드")
    ap.add_argument("--map", action="append", default=[], help="컬럼 직접 지정: key=컬럼명 (예: kcal=에너지(kcal))")
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N 개만 (시험용)")
    ap.add_argument("--dedupe-name", action="store_true", help="같은 이름(·제조사) 중복 행은 처음 것만")
    a = ap.parse_args(argv)

    headers, rows = read_csv(a.csv)
    overrides = dict(m.split("=", 1) for m in a.map)
    cols = resolve_columns(headers, overrides)
    missing = [k for k in REQUIRED if not cols.get(k)]
    print("찾은 컬럼:", {k: v for k, v in cols.items() if v})
    if missing:
        print(f"필수 컬럼을 못 찾았어요: {missing}", file=sys.stderr)
        print("파일의 컬럼:", headers, file=sys.stderr)
        print("→ --map name=식품명 처럼 직접 지정해 주세요.", file=sys.stderr)
        return 2
    data, skipped = convert(rows[: a.limit] if a.limit else rows, cols, f"식약처 식품영양성분 표준데이터 ({a.csv.name})", a.dedupe_name)
    print(f"원본 {len(rows)}행 → 변환 {len(data)}개 · 건너뜀 {len(skipped)}개")
    for s in skipped[:10]:
        print("  건너뜀:", s)
    for r in data[:5]:
        print(f"  예: {r.name} ({r.category}) {r.basis_label} {r.kcal:g}kcal 탄{r.carb_g} 단{r.protein_g} 지{r.fat_g}")
    if a.dry_run or not data:
        return 0 if data else 1
    if a.out:
        if a.chunk:
            for n, i in enumerate(range(0, len(data), a.chunk), start=1):
                p = a.out.with_name(f"{a.out.stem}_{n:03d}{a.out.suffix}")
                p.write_text(to_sql(data[i : i + a.chunk]), encoding="utf-8")
                print("저장:", p)
        else:
            a.out.write_text(to_sql(data), encoding="utf-8")
            print("저장:", a.out)
    if a.rest:
        url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요", file=sys.stderr)
            return 2
        print("업로드:", push_rest(data, url, key), "개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
