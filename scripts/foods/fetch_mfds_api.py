#!/usr/bin/env python3
"""
공공데이터포털 표준데이터 오픈 API → CSV (파일 다운로드는 5만 건 제한이라 전체는 API 로 받는다)

기본: 전국통합식품영양성분정보(가공식품)표준데이터
  https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api

사용
  DATA_GO_KR_KEY=인증키 python3 scripts/foods/fetch_mfds_api.py --out processed.csv
  → python3 scripts/foods/import_foods.py processed.csv --dry-run --dedupe-name

- 인증키는 환경변수로만 (명령어·파일에 적지 않음). '일반 인증키(Decoding)' 값을 쓴다
- 1,000건씩 페이지를 넘기며 totalCount 까지 받고, 실패한 페이지는 3번까지 다시 시도
- 응답 필드 이름(영문)을 그대로 CSV 헤더로 쓴다. import_foods.py 가 영문 이름도 알아본다
표준 라이브러리만 사용.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api"


def fetch_page(url: str, key: str, page: int, rows: int, timeout: float = 30) -> tuple[list[dict], int]:
    q = urllib.parse.urlencode({"serviceKey": key, "pageNo": page, "numOfRows": rows, "type": "json"})
    with urllib.request.urlopen(f"{url}?{q}", timeout=timeout) as res:  # noqa: S310 (공공데이터포털 주소)
        body = res.read().decode("utf-8")
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        # 인증키 오류 등은 XML 로 올 때가 있다
        raise RuntimeError(f"JSON 이 아닌 응답: {body[:200]}")
    resp = data.get("response", data)
    header = resp.get("header", {})
    code = str(header.get("resultCode", "00"))
    if code not in ("00", "0", "000"):
        if code == "03":  # 데이터 없음
            return [], 0
        raise RuntimeError(f"API 오류 {code}: {header.get('resultMsg')}")
    b = resp.get("body", {})
    items = b.get("items", [])
    if isinstance(items, dict):
        items = items.get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items, int(b.get("totalCount", len(items)))


def fetch_all(url: str, key: str, rows: int = 1000, max_pages: int = 0, sleep: float = 0.2, log=print) -> list[dict]:
    out: list[dict] = []
    page, total = 1, None
    while True:
        for attempt in range(3):
            try:
                items, t = fetch_page(url, key, page, rows)
                break
            except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
                if attempt == 2 or "API 오류" in str(e):
                    raise
                time.sleep(1.5 * (attempt + 1))
        total = t if total is None else total
        out.extend(items)
        log(f"  {page}쪽: {len(items)}건 (누적 {len(out)} / 전체 {total})")
        if not items or len(out) >= total or (max_pages and page >= max_pages):
            return out
        page += 1
        time.sleep(sleep)


def fetch_all_parallel(url: str, key: str, rows: int = 1000, workers: int = 4, log=print) -> list[dict]:
    """1쪽으로 전체 건수를 알아낸 뒤 나머지 쪽을 동시에 받는다 (순서는 쪽 번호대로 유지)"""
    from concurrent.futures import ThreadPoolExecutor

    def one(page: int) -> list[dict]:
        for attempt in range(4):
            try:
                return fetch_page(url, key, page, rows)[0]
            except (urllib.error.URLError, TimeoutError, RuntimeError, OSError) as e:
                if attempt == 3 or "API 오류" in str(e):
                    raise
                time.sleep(2 * (attempt + 1))
        return []

    first, total = fetch_page(url, key, 1, rows)
    pages = -(-total // rows) if total else 1
    out: dict[int, list[dict]] = {1: first}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for n, items in zip(range(2, pages + 1), ex.map(one, range(2, pages + 1))):
            out[n] = items
            if n % 10 == 0 or n == pages:
                log(f"  {n}/{pages}쪽 (누적 {sum(len(v) for v in out.values())} / 전체 {total})")
    return [it for n in sorted(out) for it in out[n]]


def write_csv(items: list[dict], path: Path):
    keys: list[str] = []
    for it in items:
        for k in it:
            if k not in keys:
                keys.append(k)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for it in items:
            w.writerow({k: ("" if it.get(k) is None else it.get(k)) for k in keys})


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="공공데이터포털 표준데이터 API → CSV")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--rows", type=int, default=1000)
    ap.add_argument("--max-pages", type=int, default=0, help="시험용: N 쪽까지만")
    ap.add_argument("--workers", type=int, default=1, help="동시에 받을 쪽 수 (2 이상이면 병렬, 일일 호출 한도 주의)")
    a = ap.parse_args(argv)
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("DATA_GO_KR_KEY 환경변수(일반 인증키 Decoding)가 필요해요", file=sys.stderr)
        return 2
    if a.workers > 1 and not a.max_pages:
        items = fetch_all_parallel(a.url, key, a.rows, a.workers)
    else:
        items = fetch_all(a.url, key, a.rows, a.max_pages)
    if not items:
        print("받은 데이터가 없어요", file=sys.stderr)
        return 1
    write_csv(items, a.out)
    print(f"저장: {a.out} ({len(items)}건) · 필드: {list(items[0].keys())[:12]}…")
    return 0


if __name__ == "__main__":
    sys.exit(main())
