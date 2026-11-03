# 음식 AI 학습 (1단계) — 사용자 PC 에서 실행

이 폴더 코드는 **데이터와 학습을 사용자 PC 에서** 돌리는 걸 전제로 한다.
- AI Hub 원본은 해외 서버·클라우드로 옮기지 않는다 (이용 조건)
- 개발 컨테이너에서는 PyTorch 서버 접속이 막혀 있어, torch 가 필요 없는 부분만 테스트했다 (`ai/tests/test_train_parts.py`)
- **실제 학습 결과(정확도)는 아직 없다.** 돌린 결과만 `runs/*/result.json` 에 남긴다

## 순서
1. 데이터 점검 (0단계): `python3 ai/scripts/inspect_labels.py --root <라벨폴더> --out-dir report`
2. 클래스 정하기: `classes.example.json` 을 `classes.json` 으로 복사 → 학습할 20종 이름과 SlimLog `foods.food_id` 연결
   (공용 음식은 `scripts/foods/import_foods.py` 로 넣은 뒤 `mfds-식품코드` 형태)
3. 설치: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu` → `pip install -r ai/train/requirements.txt`
4. 실험 A (마지막 층만): `python -m ai.train.train --labels <라벨> --images <이미지> --classes ai/train/classes.json --exp A --out runs/A`
5. 실험 B (마지막 2블록 미세조정): `... --exp B --unfreeze 2 --lr 3e-4 --out runs/B`
6. 비교: `runs/A/result.json` vs `runs/B/result.json` 의 `test.macro_f1`, 클래스별 `per_class`, `test_confusions`, `cpu_latency_ms`
7. 서버로: `python -m ai.train.export_onnx --run runs/B --out server/models/food_multilabel.onnx`
   → 서버 재시작하면 `GET /health` 의 `model_status` 가 `ready`, 인식 결과 `mode` 가 `model`
8. `model_versions` 테이블에 실측 지표 기록 (result.json 값 그대로)

## 설계
| 항목 | 선택 | 이유 |
|---|---|---|
| 문제 | 멀티라벨 (사진 1장 → 음식 여러 개 있음/없음) | 한 상 차림을 영역 그리기 없이 처리 |
| 손실 | BCEWithLogits + pos_weight | 클래스마다 독립 판정, 드문 클래스 보정 |
| 기준값 | 클래스별, **검증셋**에서 F1 최대 | 테스트셋 오염 방지 |
| 분할 | 그룹 해시 70/15/15 | 같은 촬영 묶음이 train·test 에 섞이지 않게 |
| 지표 | Macro-F1(정답 있는 클래스만 평균), P/R, Exact match, 클래스별 혼동표, 헷갈린 쌍, CPU 지연 | |
| 확인 필요 구간 | 기준값의 0.6배 이상 ~ 기준값 미만 | 화면 '확인 필요' |
