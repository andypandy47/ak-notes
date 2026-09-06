#!/usr/bin/env python3
"""
Compile reference/*.md into a single AGENTS.md for tools that read a flat
file instead of doing Skills-style on-demand loading (Cursor, Copilot, etc).

AGENTS.md is a generated artifact. Edit the files in reference/ and SKILL.md,
then rerun this script. Don't hand-edit AGENTS.md directly, it will be
overwritten.

Usage:
    python scripts/build_agents_md.py
"""

import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
REFERENCE_DIR = SKILL_DIR / "reference"
SKILL_MD = SKILL_DIR / "SKILL.md"
OUTPUT = SKILL_DIR / "AGENTS.md"

# Order matters for readability of the compiled doc. Keep this in sync with
# the Topics list in SKILL.md.
FILE_ORDER = [
    "project-structure.md",
    "api-layer.md",
    "state-management.md",
    "testing.md",
    "error-handling.md",
    "effects.md",
    "security.md",
    "performance.md",
    "overengineering-check.md",
    "quality-check.md",
]

MAX_SKILL_MD_LINES = 500
MAX_REFERENCE_LINES_WITHOUT_TOC = 100


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def validate() -> list[str]:
    """Return a list of problems found. Empty list means everything's fine."""
    problems = []

    if not SKILL_MD.exists():
        problems.append(f"missing SKILL.md at {SKILL_MD}")
    else:
        skill_lines = read_lines(SKILL_MD)
        if len(skill_lines) > MAX_SKILL_MD_LINES:
            problems.append(
                f"SKILL.md is {len(skill_lines)} lines, over the "
                f"{MAX_SKILL_MD_LINES}-line guideline. Split content into reference/."
            )
        skill_text = "\n".join(skill_lines)
        for filename in FILE_ORDER:
            if filename not in skill_text:
                problems.append(
                    f"SKILL.md doesn't link to reference/{filename}. "
                    "Every reference file should be reachable from SKILL.md."
                )

    for filename in FILE_ORDER:
        path = REFERENCE_DIR / filename
        if not path.exists():
            problems.append(f"expected reference file missing: {path}")
            continue
        lines = read_lines(path)
        has_toc = any(
            line.strip().lower() in ("## contents", "## table of contents")
            for line in lines
        )
        if len(lines) > MAX_REFERENCE_LINES_WITHOUT_TOC and not has_toc:
            problems.append(
                f"{filename} is {len(lines)} lines and has no table of "
                "contents. Add one so partial reads still show the full scope."
            )

    # catch reference files that exist but aren't wired into FILE_ORDER
    if REFERENCE_DIR.exists():
        actual = {p.name for p in REFERENCE_DIR.glob("*.md")}
        expected = set(FILE_ORDER)
        orphaned = actual - expected
        if orphaned:
            problems.append(
                f"reference/ has files not listed in FILE_ORDER: {sorted(orphaned)}. "
                "Add them to FILE_ORDER or remove them."
            )

    return problems


def build() -> None:
    parts = [
        "<!-- GENERATED FILE. Do not edit directly. -->",
        "<!-- Source: SKILL.md and reference/*.md in this skill's directory. -->",
        "<!-- Regenerate with: python scripts/build_agents_md.py -->",
        "",
        "# Bulletproof React architecture",
        "",
        "Conventions adapted from [bulletproof-react]"
        "(https://github.com/alan2207/bulletproof-react), MIT licensed.",
        "",
    ]

    for filename in FILE_ORDER:
        path = REFERENCE_DIR / filename
        content = path.read_text(encoding="utf-8").strip()
        # drop the "source:" comment line, it's only useful in the split files
        lines = [
            line for line in content.splitlines()
            if not line.strip().startswith("<!-- source:")
        ]
        parts.append("\n".join(lines).strip())
        parts.append("")

    OUTPUT.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


def main() -> int:
    problems = validate()
    if problems:
        print("Validation failed:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    build()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
