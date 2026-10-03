#!/usr/bin/env python3
"""Fetch an English blog URL and save as Markdown under <output_dir>/<domain>/<slug>.md."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import trafilatura
    from trafilatura.metadata import extract_metadata
except ImportError:
    print(
        "Missing dependencies. Run: pip install -r .cursor/skills/english-blog-translate/scripts/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

MIN_WORDS = 2
MAX_WORDS = 6
STOP_WORDS = frozenset(
    {"a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
)


def get_domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if not host:
        raise ValueError(f"Could not extract domain from URL: {url}")
    return host


def extract_words(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if w not in STOP_WORDS]


def pad_words(words: list[str]) -> list[str]:
    if len(words) >= MIN_WORDS:
        return words[:MAX_WORDS]
    fallback = words + ["blog", "post", "article"]
    return fallback[: max(MIN_WORDS, min(len(fallback), MAX_WORDS))]


def title_to_slug(title: str) -> str:
    primary = re.split(r"[|\-–—:]", title)[0].strip()
    return "-".join(pad_words(extract_words(primary)))


def path_to_slug(url: str) -> str:
    segments = [unquote(s) for s in urlparse(url).path.strip("/").split("/") if s]
    words: list[str] = []
    for segment in reversed(segments):
        chunk = extract_words(segment.replace("-", " ").replace("_", " "))
        words = chunk + words
        if len(words) >= MAX_WORDS:
            break
    return "-".join(pad_words(words))


def resolve_slug(title: str | None, url: str) -> str:
    if title and title.strip():
        slug = title_to_slug(title.strip())
        if len(slug.split("-")) >= MIN_WORDS:
            return slug
    return path_to_slug(url)


def fetch_markdown(url: str) -> tuple[str, str | None]:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise RuntimeError(f"Failed to download URL: {url}")

    metadata = extract_metadata(downloaded)
    title = metadata.title if metadata else None

    body = trafilatura.extract(
        downloaded,
        output_format="markdown",
        include_links=True,
        include_tables=True,
        include_formatting=True,
    )
    if not body or not body.strip():
        raise RuntimeError(f"Could not extract article content from: {url}")

    if title:
        content = f"# {title.strip()}\n\n{body.strip()}\n"
    else:
        content = f"{body.strip()}\n"

    return content, title


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch English blog URL and save as Markdown.")
    parser.add_argument("url", help="Blog article URL")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path.cwd(),
        help="Project root directory for output (default: current directory)",
    )
    args = parser.parse_args()

    url = args.url.strip()
    domain = get_domain(url)
    content, title = fetch_markdown(url)
    slug = resolve_slug(title, url)

    out_dir = args.output_dir.resolve() / domain
    out_dir.mkdir(parents=True, exist_ok=True)
    english_path = out_dir / f"{slug}.md"
    english_path.write_text(content, encoding="utf-8")

    result = {
        "domain": domain,
        "slug": slug,
        "title": title,
        "english_path": str(english_path),
        "chinese_path": str(out_dir / f"中译-{slug}.md"),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
