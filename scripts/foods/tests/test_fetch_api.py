"""fetch_mfds_api.py — 가짜 로컬 서버로 페이지 넘김·오류 처리 확인 (실제 API 호출 없음)"""
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from scripts.foods import fetch_mfds_api as f

TOTAL = 2500


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        if q["serviceKey"][0] != "good":
            body = {"response": {"header": {"resultCode": "30", "resultMsg": "SERVICE KEY IS NOT REGISTERED"}}}
        else:
            page, rows = int(q["pageNo"][0]), int(q["numOfRows"][0])
            start = (page - 1) * rows
            items = [{"foodCd": f"P{i}", "foodNm": f"제품{i}", "enerc": "100", "mfrNm": "가짜회사"} for i in range(start, min(start + rows, TOTAL))]
            body = {"response": {"header": {"resultCode": "00", "resultMsg": "NORMAL"}, "body": {"items": items, "totalCount": TOTAL, "pageNo": page}}}
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


class FetchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.srv.server_port}/api"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_pages_until_total_and_csv_imports(self):
        items = f.fetch_all(self.url, "good", rows=1000, sleep=0, log=lambda *_: None)
        self.assertEqual(len(items), TOTAL)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "out.csv"
            f.write_csv(items, p)
            from scripts.foods import import_foods as imp

            h, rows = imp.read_csv(p)
            cols = imp.resolve_columns(h, {})
            data, _ = imp.convert(rows, cols, "t")
            self.assertEqual(len(data), TOTAL)
            self.assertEqual(data[0].brand, "가짜회사")

    def test_parallel_keeps_order(self):
        items = f.fetch_all_parallel(self.url, "good", rows=300, workers=4, log=lambda *_: None)
        self.assertEqual([it["foodCd"] for it in items], [f"P{i}" for i in range(TOTAL)])

    def test_bad_key_raises(self):
        with self.assertRaises(RuntimeError):
            f.fetch_all(self.url, "bad", sleep=0, log=lambda *_: None)


if __name__ == "__main__":
    unittest.main()
