"""기상청 격자·위경도 엑셀 → src/data/regions.json (시·군·구 단위)

사용법:
    python3 scripts/build_regions.py "<격자 엑셀 경로>.xlsx"

- 「최종 업데이트 파일_...」 시트를 우선 사용하고, 없으면 첫 시트를 사용한다.
- 3단계(읍·면·동)가 비어 있고 2단계(시·군·구)가 있는 행만 사용한다.
- 시·군·구가 없는 세종특별자치시는 1단계 행을 사용한다.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "regions.json"


def norm(v):
    return "" if v is None else str(v).strip()


def main(path: str) -> None:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = next((ws for ws in wb.worksheets if "최종" in ws.title), wb.worksheets[0])
    rows = sheet.iter_rows(values_only=True)

    header = None
    for row in rows:
        cells = [norm(c) for c in row]
        if "1단계" in cells and "2단계" in cells:
            header = cells
            break
    if header is None:
        sys.exit("헤더(1단계/2단계)를 찾지 못했어요.")

    def col(*names):
        for n in names:
            for i, h in enumerate(header):
                if h.replace(" ", "") == n.replace(" ", ""):
                    return i
        sys.exit(f"열을 찾지 못했어요: {names}")

    c_code = col("행정구역코드")
    c1, c2, c3 = col("1단계"), col("2단계"), col("3단계")
    cx, cy = col("격자 X", "격자X"), col("격자 Y", "격자Y")

    regions, seen = [], set()
    for row in rows:
        r = [norm(c) for c in row]
        if len(r) <= max(c_code, c1, c2, c3, cx, cy):
            continue
        sido, sigungu, dong = r[c1], r[c2], r[c3]
        if not sido or dong:
            continue
        if not sigungu:
            if "세종" not in sido:
                continue
            sigungu = sido
        try:
            nx, ny = int(float(r[cx])), int(float(r[cy]))
        except ValueError:
            continue
        # '수원시장안구' → '수원시 장안구'
        sigungu = re.sub(r"^(.+?시)(.+구)$", r"\1 \2", sigungu)
        rid = r[c_code]
        key = (sido, sigungu)
        if rid in seen or key in seen:
            continue
        seen.update({rid, key})
        regions.append({"id": rid, "sido": sido, "sigungu": sigungu, "nx": nx, "ny": ny})

    regions.sort(key=lambda x: (x["sido"], x["sigungu"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(regions, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(regions)}개 지역 → {OUT} (시트: {sheet.title})")
    gn = [x for x in regions if x["sigungu"] == "강릉시"]
    print("강릉시 확인:", gn)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
