"""DB 없이 도는 단위 테스트 — 금칙어 검사·곡선 계산·사진 정리"""
import io

from PIL import Image

from app.images import NotAnImage, clean_photo
from app.pk import HOUR_MS, relative_curve
from app.safety import check


def test_safety_same_rules_as_frontend():
    assert check("오늘 단백질 챙겼어요")[0] == "LOW"
    level, m = check("남은 펜 필요하신 분 양 도해요. 쪽지 주세요.")
    assert level == "BLOCKED" and {x.rule for x in m} == {"양도·나눔"}
    assert check("몇 mg부터 올리세요?")[0] == "REVIEW"
    assert check("○○약국 다녀왔어요")[0] == "REVIEW"
    assert check("처방전 없이 살 수 있나요")[0] == "BLOCKED"


def test_curve_relative_and_peak_at_dose():
    t0 = 1_700_000_000_000
    doses = [(t0, 2.5), (t0 + 168 * HOUR_MS, 2.5)]
    pts = relative_curve(doses, 120, t0 - HOUR_MS, t0 + 200 * HOUR_MS)
    assert max(p["relative"] for p in pts) == 100
    peak = max(pts, key=lambda p: p["relative"])
    assert peak["t"] == t0 + 168 * HOUR_MS  # 두 번째 투약 직후가 최고
    before = [p for p in pts if p["t"] < t0]
    assert all(p["relative"] == 0 for p in before)


def test_curve_without_half_life_is_empty():
    assert relative_curve([(0, 1)], None, 0, 10) == []


def test_clean_photo_removes_exif_and_resizes():
    img = Image.new("RGB", (3000, 2000), "orange")
    exif = Image.Exif()
    exif[0x8825] = {2: (37, 33, 0)}  # GPS 정보
    exif[0x010F] = "TestCamera"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    out = clean_photo(buf.getvalue())
    assert max(out.width, out.height) == 1600
    again = Image.open(io.BytesIO(out.data))
    assert len(again.getexif()) == 0


def test_clean_photo_rejects_non_image():
    try:
        clean_photo(b"not an image")
    except NotAnImage:
        return
    raise AssertionError("이미지가 아닌데 통과함")
