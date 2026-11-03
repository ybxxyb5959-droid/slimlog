"""import_foods.py 단위 테스트 — 아래 CSV 는 테스트용으로 직접 만든 가짜 데이터 (실제 영양값 아님)"""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from scripts.foods import import_foods as imp

FAKE = """식품코드,식품명,식품대분류명,영양성분함량기준량,에너지(kcal),단백질(g),지방(g),탄수화물(g),나트륨(mg),식품중량
D101,테스트비빔밥,밥류,100g,150,5.1,3.2,25.0,300,500g
D102,테스트김치찌개,찌개 및 전골류,100g,40,3,-,2.5,450,800g
D103,테스트나물,나물·숙채류,100g,60,tr,2,,120,
D104,열량없음,밥류,100g,,1,1,1,1,
D101,중복코드,밥류,100g,10,1,1,1,1,
,이름만,밥류,100g,10,1,1,1,1,
"""


def write(tmp, text, enc="utf-8"):
    p = Path(tmp) / "fake.csv"
    p.write_bytes(text.encode(enc))
    return p


class ConvertTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        headers, rows = imp.read_csv(write(self.tmp.name, FAKE))
        self.cols = imp.resolve_columns(headers, {})
        self.data, self.skipped = imp.convert(rows, self.cols, "테스트")

    def tearDown(self):
        self.tmp.cleanup()

    def test_columns_found(self):
        for k in ["code", "name", "group", "basis", "kcal", "protein", "fat", "carb", "sodium", "serving"]:
            self.assertIsNotNone(self.cols[k], k)

    def test_rows_and_skips(self):
        self.assertEqual([r.food_id for r in self.data], ["mfds-D101", "mfds-D102", "mfds-D103"])
        self.assertEqual(len(self.skipped), 3)  # 열량 없음, 중복 코드, 코드 없음

    def test_missing_values_stay_null(self):
        d102, d103 = self.data[1], self.data[2]
        self.assertIsNone(d102.fat_g)  # '-'
        self.assertIsNone(d103.protein_g)  # 'tr' 미량
        self.assertIsNone(d103.carb_g)  # 빈칸
        self.assertEqual(d103.serving_g, 100)  # 중량 없으면 기준량

    def test_categories_and_basis(self):
        self.assertEqual([r.category for r in self.data], ["밥·면", "국·찌개", "반찬"])
        self.assertEqual(self.data[0].basis_label, "100g당")
        self.assertEqual(self.data[0].serving_g, 500)

    def test_sql_escapes_and_upserts(self):
        rows = self.data + [imp.Row("mfds-X", "작은'따옴표", None, "일품", 100, "100g당", 100, 1, None, None, None, None, "t")]
        sql = imp.to_sql(rows)
        self.assertIn("'작은''따옴표'", sql)
        self.assertIn("on conflict (food_id) do update", sql)
        self.assertIn("where public.foods.owner_id is null", sql)  # 사용자 음식은 덮어쓰지 않음
        self.assertTrue(sql.strip().endswith("commit;"))


class EncodingAndCliTest(unittest.TestCase):
    def test_cp949(self):
        with tempfile.TemporaryDirectory() as t:
            headers, rows = imp.read_csv(write(t, FAKE, "cp949"))
            self.assertIn("식품명", headers)
            self.assertEqual(rows[0]["식품명"], "테스트비빔밥")

    def test_missing_required_column_creates_nothing(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "코드,이름\nA,B\n")
            out = Path(t) / "o.sql"
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = imp.main([str(p), "--out", str(out)])
            self.assertEqual(code, 2)
            self.assertFalse(out.exists())

    def test_map_override_and_chunk(self):
        with tempfile.TemporaryDirectory() as t:
            p = write(t, "코드,이름,열량\nA1,가,10\nA2,나,20\nA3,다,30\n")
            out = Path(t) / "seed.sql"
            with contextlib.redirect_stdout(io.StringIO()):
                code = imp.main([str(p), "--map", "code=코드", "--map", "name=이름", "--map", "kcal=열량", "--out", str(out), "--chunk", "2"])
            self.assertEqual(code, 0)
            self.assertEqual(sorted(x.name for x in Path(t).glob("seed_*.sql")), ["seed_001.sql", "seed_002.sql"])


if __name__ == "__main__":
    unittest.main()
