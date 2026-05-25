#!/usr/bin/env python3
"""두 임베딩 벡터 간 코사인 유사도를 계산하는 스크립트.

사용법:
  # JSON 배열 직접 전달
  python cosine_similarity.py '[-0.023, 0.145, ...]' '[-0.018, 0.152, ...]'

  # JSON 파일에서 읽기
  python cosine_similarity.py -a embedding_a.json -b embedding_b.json

  # 대화형 모드
  python cosine_similarity.py -i
"""

import argparse
import json
import math
import sys


def dot_product(a: list[float], b: list[float]) -> float:
    return sum(ai * bi for ai, bi in zip(a, b))


def norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    return dot_product(a, b) / (norm(a) * norm(b))


def main() -> None:
    parser = argparse.ArgumentParser(description="코사인 유사도 계산")
    parser.add_argument("a", nargs="?", help="벡터 A (JSON 배열)")
    parser.add_argument("b", nargs="?", help="벡터 B (JSON 배열)")
    parser.add_argument("-a", "--file-a", help="벡터 A JSON 파일")
    parser.add_argument("-b", "--file-b", help="벡터 B JSON 파일")
    parser.add_argument("-i", "--interactive", action="store_true", help="대화형 모드")
    args = parser.parse_args()

    if args.interactive:
        a_json = input("벡터 A (JSON 배열): ").strip()
        b_json = input("벡터 B (JSON 배열): ").strip()
    elif args.file_a and args.file_b:
        with open(args.file_a) as f:
            a_json = f.read().strip()
        with open(args.file_b) as f:
            b_json = f.read().strip()
    elif args.a and args.b:
        a_json = args.a
        b_json = args.b
    else:
        parser.print_help()
        sys.exit(1)

    a = json.loads(a_json)
    b = json.loads(b_json)

    if len(a) != len(b):
        print(f"오류: 벡터 차원이 일치하지 않습니다 (A: {len(a)}, B: {len(b)})", file=sys.stderr)
        sys.exit(1)

    dot = dot_product(a, b)
    norm_a = norm(a)
    norm_b = norm(b)
    sim = dot / (norm_a * norm_b)

    print(f"벡터 A: {len(a)}차원")
    print(f"벡터 B: {len(b)}차원")
    print(f"A·B = {dot}")
    print(f"|A| = {norm_a}")
    print(f"|B| = {norm_b}")
    print(f"cos(θ) = (A·B) / (|A|×|B|) = {dot} / ({norm_a}×{norm_b}) = {sim}")
    print(f"유사도 = {sim * 100:.1f}%")


if __name__ == "__main__":
    main()
