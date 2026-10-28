"""Weekly summary for coordinators. Step 1: connect and count animals by stage."""

import os
from datetime import date
from pathlib import Path

import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://safepaws:safepaws@localhost:5432/safepaws")
OUTPUT_FOLDER = Path(__file__).parent / "output"
STAGES = ["reported", "vet", "recovering", "ready", "adopted"]


def count_by_stage(conn):
    rows = conn.execute("select stage, count(*) from animals group by stage").fetchall()
    return dict(rows)


def build_report(counts):
    lines = [f"# Weekly report, {date.today():%d %B %Y}", "", "Animals in each stage:"]
    for stage in STAGES:
        n = counts.get(stage, 0)
        lines.append(f"- {stage}: {n}")
    lines.append("")
    lines.append(f"Total: {sum(counts.values())}")
    return "\n".join(lines) + "\n"


def save_report(text):
    OUTPUT_FOLDER.mkdir(exist_ok=True)
    doc = OUTPUT_FOLDER / f"weekly-report-{date.today()}.md"
    doc.write_text(text, encoding="utf-8")
    return doc


def main():
    with psycopg.connect(DATABASE_URL) as conn:
        counts = count_by_stage(conn)

    report = build_report(counts)
    print(report)
    doc = save_report(report)
    print(f"Saved to {doc}")


if __name__ == "__main__":
    main()