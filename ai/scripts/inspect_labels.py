#!/usr/bin/env python3
"""
SlimLog 음식 라벨 점검 도구 (0단계 · 읽기 전용)

AI Hub 등 음식 이미지 데이터셋의 라벨(JSON)을 읽기만 하고 아래를 집계한다.
  - 이미지당 전체 박스 수 / 서로 다른 음식 클래스 수
  - 서로 다른 음식이 2종 이상 등장하는 이미지 비율 (멀티라벨 적합성의 핵심 지표)
  - 클래스별 이미지 등장 수·박스 수, 음식 조합별 빈도, 함께 등장하는 쌍
  - 잘못된 JSON, 라벨 누락, 중복 이미지 ID

원칙
  - 데이터 폴더에는 아무것도 쓰지 않는다. (--out-dir 이 데이터 폴더 안이면 거부)
  - 실제로 읽은 파일에서 나온 숫자만 출력한다. 읽은 라벨이 없으면 통계를 만들지 않는다.
  - JSON 스키마가 데이터셋마다 다르므로 '라벨 추출'을 별도 추출기(Extractor)로 분리한다.

사용 예
  python ai/scripts/inspect_labels.py --root /path/to/labels
  python ai/scripts/inspect_labels.py --root ./labels --classes ai/classes_candidate.txt --out-dir ./report
  python ai/scripts/inspect_labels.py --root ./labels --extractor generic --class-key 음식명 --image-key 파일명

표준 라이브러리만 사용 (추가 설치 없음). Python 3.9+.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from itertools import combinations
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator

# ---------------------------------------------------------------------------
# 데이터 구조
# ---------------------------------------------------------------------------


@dataclass
class ImageLabels:
    """한 이미지의 라벨 — labels 는 박스(객체) 하나당 클래스 이름 하나"""

    image_id: str
    labels: list[str]
    source: str  # 어느 JSON 파일에서 왔는지
    missing_label_objects: int = 0  # 박스는 있는데 클래스 이름이 없는 객체 수


@dataclass
class ParseIssue:
    path: str
    kind: str  # invalid_json | no_annotations | read_error
    detail: str = ""


# ---------------------------------------------------------------------------
# 라벨 추출기 — 스키마별로 교체 가능
# ---------------------------------------------------------------------------

# 흔히 쓰이는 키 후보 (확인된 스키마가 아니라 '찾아볼 후보'다)
DEFAULT_CLASS_KEYS = ["Name", "name", "label", "Label", "class", "class_name", "category", "category_name", "food_name", "음식명", "음식이름", "클래스"]
DEFAULT_IMAGE_KEYS = ["Code Name", "code_name", "file_name", "filename", "image_id", "image", "imagePath", "파일명", "이미지명"]
# 박스 좌표처럼 보이는 키. 이미지 정보(width/height)와 헷갈리지 않게 좁게 잡는다.
BOX_HINT_KEYS = {"W", "H", "X", "Y", "bbox", "box", "Point", "points", "xmin", "ymin", "xmax", "ymax", "polygon"}


@dataclass
class ExtractorConfig:
    class_keys: list[str] = field(default_factory=lambda: list(DEFAULT_CLASS_KEYS))
    image_keys: list[str] = field(default_factory=lambda: list(DEFAULT_IMAGE_KEYS))


Extractor = Callable[[Any, Path, ExtractorConfig], list[ImageLabels]]


def _first_str(d: dict, keys: list[str]) -> str | None:
    for k in keys:
        v = d.get(k)
        if isinstance(v, bool):
            continue
        if isinstance(v, (str, int)) and str(v).strip():
            return str(v).strip()
    return None


def _has_labeled(node: Any, cfg: ExtractorConfig) -> bool:
    """하위 어딘가에 클래스 이름이 붙은 dict 가 있는지"""
    if isinstance(node, dict):
        if _first_str(node, cfg.class_keys) is not None:
            return True
        return any(_has_labeled(v, cfg) for v in node.values() if isinstance(v, (dict, list)))
    if isinstance(node, list):
        return any(_has_labeled(v, cfg) for v in node)
    return False


def _walk_objects(node: Any, cfg: ExtractorConfig) -> Iterator[dict]:
    """
    JSON 트리를 돌며 '객체(박스)'를 모은다.
      - 클래스 이름이 있고, 아래에 또 다른 라벨 객체가 없으면 → 라벨 객체
      - 클래스 이름은 없는데 박스 좌표 키가 있고, 아래에 라벨 객체가 없으면 → 라벨 누락 객체
      - 그 외에는 더 내려간다
    """
    if isinstance(node, dict):
        children_labeled = any(_has_labeled(v, cfg) for v in node.values() if isinstance(v, (dict, list)))
        if not children_labeled:
            if _first_str(node, cfg.class_keys) is not None or (BOX_HINT_KEYS & set(node.keys())):
                yield node
                return
        for v in node.values():
            if isinstance(v, (dict, list)):
                yield from _walk_objects(v, cfg)
    elif isinstance(node, list):
        for v in node:
            yield from _walk_objects(v, cfg)


def extract_coco(data: Any, path: Path, cfg: ExtractorConfig) -> list[ImageLabels]:
    """COCO 형식: {images:[{id,file_name}], annotations:[{image_id, category_id}], categories:[{id,name}]}"""
    if not (isinstance(data, dict) and isinstance(data.get("annotations"), list) and isinstance(data.get("categories"), list)):
        return []
    cats = {c.get("id"): str(c.get("name", "")).strip() for c in data["categories"] if isinstance(c, dict)}
    by_img: dict[Any, ImageLabels] = {}
    for i in data.get("images", []) or []:
        if isinstance(i, dict):
            by_img[i.get("id")] = ImageLabels(image_id=str(i.get("file_name") or i.get("id")), labels=[], source=str(path))
    for a in data["annotations"]:
        if not isinstance(a, dict):
            continue
        i_id = a.get("image_id")
        rec = by_img.setdefault(i_id, ImageLabels(image_id=str(i_id), labels=[], source=str(path)))
        name = cats.get(a.get("category_id"), "")
        if name:
            rec.labels.append(name)
        else:
            rec.missing_label_objects += 1
    return list(by_img.values())


def _collect(objs: list[dict], default_id: str, path: Path, cfg: ExtractorConfig) -> list[ImageLabels]:
    """객체를 이미지 ID 별로 묶는다. 객체에 이미지 키가 있으면 그걸, 없으면 default_id"""
    by_id: dict[str, ImageLabels] = {}
    for o in objs:
        image_id = _first_str(o, cfg.image_keys) or default_id
        rec = by_id.setdefault(image_id, ImageLabels(image_id=image_id, labels=[], source=str(path)))
        name = _first_str(o, cfg.class_keys)
        if name:
            rec.labels.append(name)
        else:
            rec.missing_label_objects += 1
    if not by_id:
        by_id[default_id] = ImageLabels(image_id=default_id, labels=[], source=str(path))
    return list(by_id.values())


def extract_generic(data: Any, path: Path, cfg: ExtractorConfig) -> list[ImageLabels]:
    """
    범용 추출기 — 스키마를 모를 때.
      A) 최상위가 '이미지 단위 묶음'의 목록이면 → 원소 하나 = 이미지 하나
         (원소 자체가 박스가 아니라, 안에 박스들을 품고 있는 경우)
      B) 그 외 → 파일 안 박스를 모두 모은 뒤, 박스에 이미지 키가 있으면 그 기준으로 묶고
         없으면 '최상위 이미지 키 → 파일 이름' 순으로 이미지 ID 를 정한다.
    """
    if isinstance(data, list) and data and all(isinstance(x, dict) for x in data):
        is_units = all(_has_labeled(x, cfg) and list(_walk_objects(x, cfg)) != [x] for x in data)
        if is_units:
            out: list[ImageLabels] = []
            for idx, x in enumerate(data):
                unit_id = _first_str(x, cfg.image_keys) or f"{path.stem}#{idx}"
                out.extend(_collect(list(_walk_objects(x, cfg)), unit_id, path, cfg))
            return out
    top_id = (_first_str(data, cfg.image_keys) if isinstance(data, dict) else None) or path.stem
    if isinstance(data, dict):
        for v in data.values():  # {"image": {"file_name": ...}} 처럼 한 단계 안에 있는 경우
            if isinstance(v, dict) and not _has_labeled(v, cfg) and _first_str(v, cfg.image_keys):
                top_id = _first_str(data, cfg.image_keys) or _first_str(v, cfg.image_keys) or top_id
                break
    return _collect(list(_walk_objects(data, cfg)), top_id, path, cfg)


def extract_auto(data: Any, path: Path, cfg: ExtractorConfig) -> list[ImageLabels]:
    return extract_coco(data, path, cfg) or extract_generic(data, path, cfg)


EXTRACTORS: dict[str, Extractor] = {"auto": extract_auto, "coco": extract_coco, "generic": extract_generic}


# ---------------------------------------------------------------------------
# 파일 읽기 (읽기 전용)
# ---------------------------------------------------------------------------


def iter_json_files(root: Path, pattern: str) -> Iterator[Path]:
    if root.is_file():
        yield root
        return
    yield from sorted(p for p in root.glob(pattern) if p.is_file())


def load_labels(root: Path, pattern: str, extractor: Extractor, cfg: ExtractorConfig) -> tuple[list[ImageLabels], list[ParseIssue], int]:
    records: list[ImageLabels] = []
    issues: list[ParseIssue] = []
    n_files = 0
    for p in iter_json_files(root, pattern):
        n_files += 1
        try:
            with p.open("r", encoding="utf-8-sig") as f:  # BOM 대응, 읽기 전용
                data = json.load(f)
        except json.JSONDecodeError as e:
            issues.append(ParseIssue(str(p), "invalid_json", f"{e.msg} (line {e.lineno})"))
            continue
        except (OSError, UnicodeDecodeError) as e:
            issues.append(ParseIssue(str(p), "read_error", str(e)))
            continue
        recs = extractor(data, p, cfg)
        if not recs or all(not r.labels and not r.missing_label_objects for r in recs):
            issues.append(ParseIssue(str(p), "no_annotations", "라벨 객체를 찾지 못함 (--class-key / --extractor 확인)"))
        records.extend(recs)
    return records, issues, n_files


# ---------------------------------------------------------------------------
# 집계
# ---------------------------------------------------------------------------


@dataclass
class Report:
    files_total: int
    files_ok: int
    issues: list[ParseIssue]
    images_total: int
    images_with_labels: int
    images_without_labels: int
    duplicate_image_ids: dict[str, list[str]]
    missing_label_objects: int
    boxes_total: int
    boxes_per_image: Counter
    distinct_per_image: Counter
    multi_class_images: int  # 서로 다른 음식 2종 이상
    class_image_counts: Counter  # 클래스가 등장한 이미지 수
    class_box_counts: Counter
    combo_counts: Counter  # frozenset(클래스들) → 이미지 수
    pair_counts: Counter
    class_filter: list[str] | None
    unmatched_filter_classes: list[str]

    @property
    def multi_class_ratio(self) -> float | None:
        return None if self.images_with_labels == 0 else self.multi_class_images / self.images_with_labels


def build_report(records: list[ImageLabels], issues: list[ParseIssue], n_files: int, class_filter: list[str] | None = None, dup_policy: str = "first") -> Report:
    # 중복 이미지 ID 처리
    seen: dict[str, ImageLabels] = {}
    dups: dict[str, list[str]] = defaultdict(list)
    for r in records:
        if r.image_id in seen:
            dups[r.image_id].append(r.source)
            if dup_policy == "merge":
                seen[r.image_id].labels.extend(r.labels)
                seen[r.image_id].missing_label_objects += r.missing_label_objects
            continue  # first: 처음 것만 사용
        seen[r.image_id] = ImageLabels(r.image_id, list(r.labels), r.source, r.missing_label_objects)
    for k in dups:
        dups[k].insert(0, seen[k].source)

    wanted = set(class_filter) if class_filter else None
    all_classes: set[str] = set()
    boxes_per_image: Counter = Counter()
    distinct_per_image: Counter = Counter()
    class_image: Counter = Counter()
    class_box: Counter = Counter()
    combos: Counter = Counter()
    pairs: Counter = Counter()
    multi = 0
    with_labels = 0
    boxes_total = 0
    missing = 0

    for r in seen.values():
        missing += r.missing_label_objects
        all_classes.update(r.labels)
        labels = [l for l in r.labels if wanted is None or l in wanted]
        if not labels:
            continue
        with_labels += 1
        distinct = sorted(set(labels))
        boxes_total += len(labels)
        boxes_per_image[len(labels)] += 1
        distinct_per_image[len(distinct)] += 1
        class_box.update(labels)
        class_image.update(distinct)
        combos[tuple(distinct)] += 1
        if len(distinct) >= 2:
            multi += 1
            pairs.update(combinations(distinct, 2))

    return Report(
        files_total=n_files,
        files_ok=n_files - sum(1 for i in issues if i.kind in ("invalid_json", "read_error")),
        issues=issues,
        images_total=len(seen),
        images_with_labels=with_labels,
        images_without_labels=len(seen) - with_labels,
        duplicate_image_ids=dict(dups),
        missing_label_objects=missing,
        boxes_total=boxes_total,
        boxes_per_image=boxes_per_image,
        distinct_per_image=distinct_per_image,
        multi_class_images=multi,
        class_image_counts=class_image,
        class_box_counts=class_box,
        combo_counts=combos,
        pair_counts=pairs,
        class_filter=sorted(wanted) if wanted else None,
        unmatched_filter_classes=sorted(wanted - all_classes) if wanted else [],
    )


# ---------------------------------------------------------------------------
# 출력
# ---------------------------------------------------------------------------


def _pct(n: int, d: int) -> str:
    return "-" if d == 0 else f"{n / d * 100:.1f}%"


def format_report(rep: Report, top: int = 20) -> str:
    L: list[str] = []
    L.append("=== SlimLog 라벨 점검 결과 (읽은 파일 기준 실측) ===")
    L.append(f"JSON 파일: {rep.files_total}개 (읽기 성공 {rep.files_ok}개)")
    by_kind = Counter(i.kind for i in rep.issues)
    if rep.issues:
        L.append(f"문제 파일: 잘못된 JSON {by_kind['invalid_json']} · 읽기 오류 {by_kind['read_error']} · 라벨 없음 {by_kind['no_annotations']}")
    if rep.class_filter:
        L.append(f"클래스 필터: {len(rep.class_filter)}종 적용 (필터 밖 라벨은 집계에서 제외)")
        if rep.unmatched_filter_classes:
            L.append(f"  ! 데이터에서 찾지 못한 필터 클래스: {', '.join(rep.unmatched_filter_classes)}")
    if rep.images_with_labels == 0:
        L.append("")
        L.append("라벨이 있는 이미지를 찾지 못했어요. 통계를 만들지 않습니다.")
        L.append("→ --extractor / --class-key / --image-key / --pattern 을 확인해 주세요.")
        return "\n".join(L)

    L.append(f"이미지: {rep.images_total}개 (라벨 있음 {rep.images_with_labels} · 없음 {rep.images_without_labels})")
    L.append(f"중복 이미지 ID: {len(rep.duplicate_image_ids)}개 · 클래스 이름 없는 객체: {rep.missing_label_objects}개")
    L.append(f"전체 박스(객체): {rep.boxes_total}개")
    L.append("")
    L.append(f"[핵심] 서로 다른 음식 2종 이상 이미지: {rep.multi_class_images}개 / {rep.images_with_labels}개 ({_pct(rep.multi_class_images, rep.images_with_labels)})")
    L.append("")
    L.append("이미지당 서로 다른 음식 수 분포:")
    for k in sorted(rep.distinct_per_image):
        L.append(f"  {k}종: {rep.distinct_per_image[k]}개 ({_pct(rep.distinct_per_image[k], rep.images_with_labels)})")
    L.append("이미지당 박스 수 분포:")
    for k in sorted(rep.boxes_per_image):
        L.append(f"  {k}개: {rep.boxes_per_image[k]}개")
    L.append("")
    L.append(f"클래스: {len(rep.class_image_counts)}종 — 등장 이미지 수 상위 {top}")
    for name, n in rep.class_image_counts.most_common(top):
        L.append(f"  {name}: 이미지 {n} · 박스 {rep.class_box_counts[name]}")
    L.append("")
    L.append(f"음식 조합 상위 {top} (2종 이상만)")
    multi_combos = [(c, n) for c, n in rep.combo_counts.most_common() if len(c) >= 2][:top]
    if not multi_combos:
        L.append("  (없음)")
    for c, n in multi_combos:
        L.append(f"  {' + '.join(c)}: {n}")
    L.append(f"함께 등장하는 쌍 상위 {top}")
    if not rep.pair_counts:
        L.append("  (없음)")
    for (a, b), n in rep.pair_counts.most_common(top):
        L.append(f"  {a} & {b}: {n}")
    if rep.duplicate_image_ids:
        L.append("")
        L.append("중복 이미지 ID 예시 (처음 5개):")
        for k, srcs in list(rep.duplicate_image_ids.items())[:5]:
            L.append(f"  {k}: {len(srcs)}곳 — {', '.join(srcs[:3])}")
    if rep.issues:
        L.append("")
        L.append("문제 파일 예시 (처음 5개):")
        for i in rep.issues[:5]:
            L.append(f"  [{i.kind}] {i.path} {i.detail}")
    return "\n".join(L)


def report_to_dict(rep: Report) -> dict:
    return {
        "files_total": rep.files_total,
        "files_ok": rep.files_ok,
        "issues": [i.__dict__ for i in rep.issues],
        "images_total": rep.images_total,
        "images_with_labels": rep.images_with_labels,
        "images_without_labels": rep.images_without_labels,
        "duplicate_image_ids": rep.duplicate_image_ids,
        "missing_label_objects": rep.missing_label_objects,
        "boxes_total": rep.boxes_total,
        "boxes_per_image": {str(k): v for k, v in sorted(rep.boxes_per_image.items())},
        "distinct_classes_per_image": {str(k): v for k, v in sorted(rep.distinct_per_image.items())},
        "multi_class_images": rep.multi_class_images,
        "multi_class_ratio": rep.multi_class_ratio,
        "class_image_counts": dict(rep.class_image_counts.most_common()),
        "class_box_counts": dict(rep.class_box_counts.most_common()),
        "combo_counts": [{"classes": list(c), "images": n} for c, n in rep.combo_counts.most_common()],
        "pair_counts": [{"a": a, "b": b, "images": n} for (a, b), n in rep.pair_counts.most_common()],
        "class_filter": rep.class_filter,
        "unmatched_filter_classes": rep.unmatched_filter_classes,
    }


def write_outputs(rep: Report, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    p = out_dir / "label_report.json"
    p.write_text(json.dumps(report_to_dict(rep), ensure_ascii=False, indent=2), encoding="utf-8")
    written.append(p)
    p = out_dir / "class_counts.csv"
    with p.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["class", "images", "boxes"])
        for name, n in rep.class_image_counts.most_common():
            w.writerow([name, n, rep.class_box_counts[name]])
    written.append(p)
    p = out_dir / "combo_counts.csv"
    with p.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["n_classes", "classes", "images"])
        for c, n in rep.combo_counts.most_common():
            w.writerow([len(c), " + ".join(c), n])
    written.append(p)
    return written


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _is_inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def read_class_file(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    return [l.strip() for l in lines if l.strip() and not l.strip().startswith("#")]


def main(argv: Iterable[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="음식 데이터셋 라벨(JSON) 읽기 전용 점검")
    ap.add_argument("--root", required=True, type=Path, help="라벨 JSON 폴더 또는 파일")
    ap.add_argument("--pattern", default="**/*.json", help="찾을 파일 패턴 (기본 **/*.json)")
    ap.add_argument("--extractor", choices=sorted(EXTRACTORS), default="auto")
    ap.add_argument("--class-key", action="append", default=[], help="클래스 이름 키 (여러 번 지정 가능, 기본 후보보다 먼저 찾음)")
    ap.add_argument("--image-key", action="append", default=[], help="이미지 ID 키 (여러 번 지정 가능)")
    ap.add_argument("--classes", type=Path, help="관심 클래스 목록 파일 (한 줄에 하나) — 이 클래스만 집계")
    ap.add_argument("--dup-policy", choices=["first", "merge"], default="first", help="중복 이미지 ID: first=처음 것만, merge=라벨 합치기")
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--out-dir", type=Path, help="JSON/CSV 결과 저장 폴더 (데이터 폴더 밖이어야 함)")
    args = ap.parse_args(list(argv) if argv is not None else None)

    if not args.root.exists():
        print(f"경로가 없어요: {args.root}", file=sys.stderr)
        return 2
    if args.out_dir and _is_inside(args.out_dir, args.root if args.root.is_dir() else args.root.parent):
        print("결과 폴더가 데이터 폴더 안에 있어요. 원본 보호를 위해 데이터 폴더 밖을 지정해 주세요.", file=sys.stderr)
        return 2

    cfg = ExtractorConfig(class_keys=args.class_key + DEFAULT_CLASS_KEYS, image_keys=args.image_key + DEFAULT_IMAGE_KEYS)
    records, issues, n_files = load_labels(args.root, args.pattern, EXTRACTORS[args.extractor], cfg)
    if n_files == 0:
        print("JSON 파일을 찾지 못했어요. 통계를 만들지 않습니다.", file=sys.stderr)
        return 1
    rep = build_report(records, issues, n_files, read_class_file(args.classes) if args.classes else None, args.dup_policy)
    print(format_report(rep, args.top))
    if args.out_dir and rep.images_with_labels > 0:
        for p in write_outputs(rep, args.out_dir):
            print(f"저장: {p}")
    return 0 if rep.images_with_labels > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
