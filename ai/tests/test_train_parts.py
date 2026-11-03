"""학습 파이프라인 중 torch 없이 도는 부분 — 데이터 분할·멀티핫·평가 지표·기준값·서버 정보 파일 (가짜 데이터)"""
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from ai.train.data import build_samples, group_of, load_class_map, multi_hot, split_groups
from ai.train.export_onnx import build_meta
from ai.train.metrics import confusion_pairs, evaluate, tune_thresholds


class DataTest(unittest.TestCase):
    def test_group_of(self):
        self.assertEqual(group_of("A001_03.jpg", None), "A001")
        self.assertEqual(group_of("meal-2024-07.jpg", r"^(meal-\d{4})"), "meal-2024")

    def test_split_is_deterministic_and_keeps_groups(self):
        from ai.train.data import Sample

        samples = [Sample(Path(f"g{g}_{i}.jpg"), ["a"], f"g{g}") for g in range(40) for i in range(3)]
        a, b = split_groups(samples), split_groups(samples)
        self.assertEqual([s.image for s in a["test"]], [s.image for s in b["test"]])
        where = {}
        for part, ss in a.items():
            for s in ss:
                self.assertEqual(where.setdefault(s.group, part), part)  # 같은 그룹은 한쪽에만
        self.assertTrue(all(len(v) > 0 for v in a.values()))

    def test_build_samples_from_labels(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "labels").mkdir()
            (d / "images").mkdir()
            for name, foods in {"m1_01.jpg": ["쌀밥", "김치찌개"], "m2_01.jpg": ["라면"], "m3_01.jpg": ["쌀밥"]}.items():
                (d / "labels" / f"{name}.json").write_text(json.dumps([{"Code Name": name, "Name": f, "W": 1} for f in foods], ensure_ascii=False), encoding="utf-8")
                if name != "m3_01.jpg":
                    (d / "images" / name).write_bytes(b"x")
            cls = d / "classes.json"
            cls.write_text(json.dumps({"쌀밥": "mfds-1", "김치찌개": "mfds-2"}, ensure_ascii=False), encoding="utf-8")
            samples, stats = build_samples(d / "labels", d / "images", load_class_map(cls))
            self.assertEqual([s.labels for s in samples], [["김치찌개", "쌀밥"]])
            self.assertEqual(stats["no_target_class"], 1)  # 라면만 있는 사진
            self.assertEqual(stats["missing_image"], 1)  # 이미지 파일 없음

    def test_multi_hot(self):
        self.assertEqual(multi_hot(["b"], ["a", "b", "c"]), [0.0, 1.0, 0.0])


class MetricsTest(unittest.TestCase):
    def setUp(self):
        self.names = ["밥", "국", "김치"]
        self.y = np.array([[1, 1, 0], [1, 0, 1], [0, 1, 0], [1, 0, 0]])
        self.s = np.array([[0.9, 0.7, 0.2], [0.8, 0.3, 0.6], [0.2, 0.9, 0.4], [0.7, 0.1, 0.1]])

    def test_perfect_thresholds_give_f1_1(self):
        th = tune_thresholds(self.y, self.s)
        m = evaluate(self.y, self.s, th, self.names)
        self.assertAlmostEqual(m["macro_f1"], 1.0)
        self.assertAlmostEqual(m["exact_match"], 1.0)

    def test_counts_and_exact_match(self):
        m = evaluate(self.y, self.s, np.array([0.5, 0.5, 0.5]), self.names)
        kimchi = m["per_class"][2]
        self.assertEqual((kimchi["tp"], kimchi["fp"], kimchi["fn"]), (1, 0, 0))
        self.assertEqual(m["n_images"], 4)
        self.assertGreater(m["exact_match"], 0.0)

    def test_absent_class_excluded_from_macro(self):
        y = np.array([[1, 0, 0], [1, 0, 0]])
        s = np.array([[0.9, 0.1, 0.1], [0.8, 0.1, 0.1]])
        m = evaluate(y, s, np.array([0.5, 0.5, 0.5]), self.names)
        self.assertAlmostEqual(m["macro_f1"], 1.0)  # 국·김치는 정답이 없어서 평균에서 뺌

    def test_confusion_pairs(self):
        y = np.array([[1, 0, 0]])
        pred = np.array([[0, 1, 0]])
        self.assertEqual(confusion_pairs(y, pred, self.names), [{"true": "밥", "predicted": "국", "count": 1}])


class MetaTest(unittest.TestCase):
    def test_meta_for_server(self):
        result = {"experiment": "A", "arch": "efficientnet_b0", "classes": ["쌀밥", "국"], "food_ids": ["mfds-1", ""], "thresholds": [0.4, 0.6],
                  "test": {"macro_f1": 0.8, "macro_precision": 0.8, "macro_recall": 0.8, "micro_f1": 0.8, "exact_match": 0.5}, "cpu_latency_ms": 30.0}
        m = build_meta(result, "v1")
        self.assertEqual(m["classes"], ["mfds-1", "국"])
        self.assertEqual(m["thresholds"], [0.4, 0.6])
        self.assertTrue(m["warnings"])  # food_id 빠진 클래스 경고


if __name__ == "__main__":
    unittest.main()
