"""
inspect_labels.py 단위 테스트 (표준 unittest)
실행: python3 -m unittest discover -s ai/tests -t .

fixtures/synthetic 의 JSON 은 테스트용으로 직접 만든 가짜 데이터다. (AI Hub 실데이터 아님)
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path

from ai.scripts import inspect_labels as il

FIX = Path(__file__).parent / "fixtures" / "synthetic"
CFG = il.ExtractorConfig()


def run(root: Path, **kw) -> il.Report:
    recs, issues, n = il.load_labels(root, "**/*.json", il.EXTRACTORS[kw.pop("extractor", "auto")], kw.pop("cfg", CFG))
    return il.build_report(recs, issues, n, **kw)


def write(dirpath: Path, name: str, obj) -> Path:
    p = dirpath / name
    p.write_text(obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    return p


class AihubLikeTest(unittest.TestCase):
    def setUp(self):
        self.rep = run(FIX / "aihub_like")

    def test_image_and_box_counts(self):
        r = self.rep
        self.assertEqual(r.files_total, 5)
        self.assertEqual(r.images_total, 4)  # img_001 중복은 1개로
        self.assertEqual(r.images_with_labels, 4)
        self.assertEqual(r.boxes_total, 9)  # 3 + 3 + 1 + 2 (중복 파일 박스 제외)
        self.assertEqual(dict(r.boxes_per_image), {3: 2, 1: 1, 2: 1})

    def test_distinct_classes_differ_from_boxes(self):
        # img_002: 박스 3개지만 서로 다른 음식은 2종, img_004: 박스 2개 · 1종
        r = self.rep
        self.assertEqual(dict(r.distinct_per_image), {3: 1, 2: 1, 1: 2})

    def test_multi_class_ratio(self):
        self.assertEqual(self.rep.multi_class_images, 2)
        self.assertAlmostEqual(self.rep.multi_class_ratio, 0.5)

    def test_class_image_vs_box_counts(self):
        r = self.rep
        self.assertEqual(r.class_image_counts["배추김치"], 2)
        self.assertEqual(r.class_box_counts["배추김치"], 3)
        self.assertEqual(r.class_image_counts["김밥"], 1)
        self.assertEqual(r.class_box_counts["김밥"], 2)
        self.assertNotIn("계란말이", r.class_image_counts)  # 중복 파일은 first 정책으로 무시

    def test_combos_and_pairs(self):
        r = self.rep
        self.assertEqual(r.combo_counts[tuple(sorted(["쌀밥", "된장찌개", "배추김치"]))], 1)
        self.assertEqual(r.combo_counts[tuple(sorted(["쌀밥", "배추김치"]))], 1)
        self.assertEqual(r.combo_counts[("닭가슴살",)], 1)
        self.assertEqual(r.pair_counts[tuple(sorted(["쌀밥", "배추김치"]))], 2)
        self.assertEqual(r.pair_counts[tuple(sorted(["쌀밥", "된장찌개"]))], 1)

    def test_duplicate_ids_reported(self):
        d = self.rep.duplicate_image_ids
        self.assertEqual(list(d), ["img_001.jpg"])
        self.assertEqual(len(d["img_001.jpg"]), 2)

    def test_duplicate_merge_policy(self):
        r = run(FIX / "aihub_like", dup_policy="merge")
        self.assertEqual(r.images_total, 4)
        self.assertEqual(r.class_image_counts["계란말이"], 1)
        self.assertEqual(r.distinct_per_image[4], 1)

    def test_class_filter(self):
        r = run(FIX / "aihub_like", class_filter=["쌀밥", "배추김치", "없는음식"])
        self.assertEqual(r.images_with_labels, 2)
        self.assertEqual(r.multi_class_images, 2)
        self.assertEqual(r.unmatched_filter_classes, ["없는음식"])
        self.assertEqual(set(r.class_image_counts), {"쌀밥", "배추김치"})


class CocoTest(unittest.TestCase):
    def test_coco(self):
        r = run(FIX / "coco")
        self.assertEqual(r.images_total, 3)
        self.assertEqual(r.images_with_labels, 2)
        self.assertEqual(r.images_without_labels, 1)  # c_003: 어노테이션 없음
        self.assertEqual(r.missing_label_objects, 1)  # category_id 99
        self.assertEqual(r.multi_class_images, 1)
        self.assertEqual(r.class_image_counts["쌀밥"], 2)


class BrokenTest(unittest.TestCase):
    def setUp(self):
        self.rep = run(FIX / "broken")

    def test_invalid_json_is_reported_not_crash(self):
        kinds = {Path(i.path).name: i.kind for i in self.rep.issues}
        self.assertEqual(kinds["bad.json"], "invalid_json")
        self.assertEqual(kinds["empty_meta.json"], "no_annotations")
        self.assertEqual(self.rep.files_total, 3)
        self.assertEqual(self.rep.files_ok, 2)

    def test_missing_class_name_counted(self):
        self.assertEqual(self.rep.missing_label_objects, 1)
        self.assertEqual(self.rep.class_box_counts["쌀밥"], 1)


class SchemaVariantsTest(unittest.TestCase):
    """스키마가 달라도 추출이 되는지"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_nested_image_info_and_annotations(self):
        write(self.d, "a.json", {
            "image": {"file_name": "n1.jpg", "width": 640, "height": 480},
            "annotations": [
                {"label": "쌀밥", "bbox": [0, 0, 1, 1]},
                {"label": "미역국", "bbox": [1, 1, 1, 1], "Point": {"x": 1, "y": 2}},
            ],
        })
        r = run(self.d)
        self.assertEqual(r.images_total, 1)
        recs, _, _ = il.load_labels(self.d, "**/*.json", il.extract_auto, CFG)
        self.assertEqual([x.image_id for x in recs], ["n1.jpg"])  # 한 단계 안의 image.file_name 사용
        self.assertEqual(r.multi_class_images, 1)
        self.assertEqual(r.missing_label_objects, 0)  # 좌표용 하위 dict 를 박스로 세지 않음

    def test_list_of_image_units(self):
        write(self.d, "units.json", [
            {"file_name": "u1.jpg", "objects": [{"name": "라면"}, {"name": "배추김치"}]},
            {"file_name": "u2.jpg", "objects": [{"name": "라면"}]},
        ])
        r = run(self.d)
        self.assertEqual(r.images_total, 2)
        self.assertEqual(r.multi_class_images, 1)
        self.assertEqual(r.class_image_counts["라면"], 2)

    def test_custom_class_key(self):
        write(self.d, "k.json", {"파일": "k1.jpg", "items": [{"음식코드명": "비빔밥", "bbox": [0, 0, 1, 1]}]})
        cfg = il.ExtractorConfig(class_keys=["음식코드명"] + il.DEFAULT_CLASS_KEYS)
        r = run(self.d, cfg=cfg)
        self.assertEqual(r.class_image_counts["비빔밥"], 1)
        # 키를 안 알려주면 클래스 이름 없는 박스로 잡힌다
        r2 = run(self.d)
        self.assertEqual(r2.images_with_labels, 0)
        self.assertEqual(r2.missing_label_objects, 1)

    def test_bom_utf8(self):
        (self.d / "bom.json").write_bytes(b"\xef\xbb\xbf" + json.dumps([{"Name": "쌀밥", "W": 1}], ensure_ascii=False).encode())
        r = run(self.d)
        self.assertEqual(r.class_image_counts["쌀밥"], 1)
        self.assertFalse(r.issues)

    def test_duplicate_id_within_same_file_merges_boxes(self):
        # 한 파일 안 같은 이미지 ID 의 박스는 한 이미지로 묶인다
        write(self.d, "same.json", [{"Code Name": "s.jpg", "Name": "쌀밥", "W": 1}, {"Code Name": "s.jpg", "Name": "쌀밥", "W": 1}])
        r = run(self.d)
        self.assertEqual(r.images_total, 1)
        self.assertEqual(r.boxes_total, 2)
        self.assertEqual(r.duplicate_image_ids, {})


class NoFakeStatsTest(unittest.TestCase):
    """실제로 읽은 라벨이 없으면 통계를 만들지 않는다"""

    def test_empty_report_has_no_ratio(self):
        rep = il.build_report([], [], 0)
        self.assertIsNone(rep.multi_class_ratio)
        text = il.format_report(rep)
        self.assertIn("통계를 만들지 않습니다", text)
        self.assertNotIn("%", text)

    def test_cli_on_empty_dir(self):
        with tempfile.TemporaryDirectory() as d:
            err = io.StringIO()
            with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
                code = il.main(["--root", d])
            self.assertEqual(code, 1)
            self.assertIn("JSON 파일을 찾지 못했어요", err.getvalue())

    def test_cli_only_broken_files(self):
        with tempfile.TemporaryDirectory() as d:
            write(Path(d), "x.json", "{not json")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = il.main(["--root", d])
            self.assertEqual(code, 1)
            self.assertIn("통계를 만들지 않습니다", out.getvalue())


class ReadOnlyTest(unittest.TestCase):
    def test_refuses_out_dir_inside_data(self):
        with tempfile.TemporaryDirectory() as d:
            write(Path(d), "a.json", [{"Name": "쌀밥", "W": 1}])
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code = il.main(["--root", d, "--out-dir", os.path.join(d, "report")])
            self.assertEqual(code, 2)
            self.assertFalse((Path(d) / "report").exists())

    def test_data_files_unchanged_and_outputs_written(self):
        with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as out:
            p = write(Path(data), "a.json", [{"Code Name": "a.jpg", "Name": "쌀밥", "W": 1}, {"Code Name": "a.jpg", "Name": "김", "W": 1}])
            before = (p.read_bytes(), p.stat().st_mtime_ns, sorted(os.listdir(data)))
            with contextlib.redirect_stdout(io.StringIO()):
                code = il.main(["--root", data, "--out-dir", out])
            self.assertEqual(code, 0)
            self.assertEqual(before, (p.read_bytes(), p.stat().st_mtime_ns, sorted(os.listdir(data))))
            rep = json.loads((Path(out) / "label_report.json").read_text(encoding="utf-8"))
            self.assertEqual(rep["multi_class_images"], 1)
            self.assertTrue((Path(out) / "class_counts.csv").exists())
            self.assertTrue((Path(out) / "combo_counts.csv").exists())


if __name__ == "__main__":
    unittest.main()
