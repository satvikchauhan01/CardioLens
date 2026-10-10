"""Build the project report: docs/REPORT.md -> docs/CardioLens_Report.pdf (BUILD_MAP T11.2).

Run from the repository root with the backend's Python:

    backend\\.venv\\Scripts\\python.exe tools\\report\\build_report.py
    backend\\.venv\\Scripts\\python.exe tools\\report\\build_report.py --captures <folder>

The Markdown file is the only source of the text. It is turned into a page of HTML with print
styles and printed to PDF by a Chromium browser that is already on the machine (Edge or Chrome),
run without a window. With --captures the figures in docs/images/ are rebuilt first, from the
screenshots that tools/report/capture_figures.mjs took and from the plots in backend/artifacts/.
The build fails when the PDF is longer than the six pages the hackathon allows.
"""

import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs"
SOURCE = DOCS / "REPORT.md"
PDF = DOCS / "CardioLens_Report.pdf"
IMAGES = DOCS / "images"
PLOTS = REPO / "backend" / "artifacts" / "plots"
MAX_PAGES = 6

BROWSERS = (
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "microsoft-edge", "google-chrome", "chromium", "chromium-browser",
)

STYLE = """
@page { size: A4; margin: 14mm 16mm 15mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 9.3pt/1.4 "Segoe UI", system-ui, -apple-system, Arial, sans-serif; color: #0f172a; }
h1 { font-size: 17pt; line-height: 1.2; margin: 0 0 4pt; }
h2 { font-size: 11.5pt; margin: 10pt 0 4pt; padding-bottom: 2pt; border-bottom: 0.6pt solid #cbd5e1; break-after: avoid; }
p { margin: 0 0 5pt; }
ul, ol { margin: 0 0 5pt; padding-left: 14pt; }
li { margin-bottom: 1.5pt; }
a { color: #0369a1; text-decoration: none; }
code { font-family: Consolas, "Cascadia Mono", Menlo, monospace; font-size: 8.5pt; background: #f1f5f9; padding: 0 2pt; border-radius: 2pt; }
pre { margin: 4pt 0 6pt; padding: 5pt 7pt; background: #f1f5f9; border-radius: 3pt; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 8.2pt; }
blockquote { margin: 5pt 0 6pt; padding: 4pt 8pt; background: #f0f9ff; border-left: 2pt solid #0369a1; font-size: 8.8pt; }
blockquote p { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 3pt 0 7pt; font-size: 8.2pt; break-inside: avoid; }
th, td { padding: 2.2pt 4pt; text-align: left; border-bottom: 0.5pt solid #cbd5e1; vertical-align: top; }
th { color: #475569; font-weight: 600; }
table.wide { font-size: 7.5pt; }
table.wide th, table.wide td { padding: 2.2pt 3pt; }
figure { margin: 6pt auto 8pt; break-inside: avoid; }
figure img { display: block; width: 100%; border: 0.5pt solid #e2e8f0; border-radius: 3pt; }
figcaption { margin-top: 3pt; font-size: 8.3pt; color: #475569; }
.meta { color: #475569; font-size: 8.8pt; }
"""


# --- figures -------------------------------------------------------------------------------------


def compose_figures(captures: Path) -> None:
    """docs/images/ from the raw screenshots and the evaluation plots."""
    from PIL import Image  # comes with matplotlib, which the backend already needs

    IMAGES.mkdir(parents=True, exist_ok=True)

    def opened(path: Path) -> "Image.Image":
        return Image.open(path).convert("RGB")

    def side_by_side(images: list, height: int, gap: int) -> "Image.Image":
        scaled = [image.resize((round(image.width * height / image.height), height), Image.LANCZOS) for image in images]
        sheet = Image.new("RGB", (sum(image.width for image in scaled) + gap * (len(scaled) - 1), height), "white")
        left = 0
        for image in scaled:
            sheet.paste(image, (left, 0))
            left += image.width + gap
        return sheet

    def narrowed(image, width: int):
        return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)

    for name in ("app_overview", "app_what_if"):
        narrowed(opened(captures / f"{name}.png"), 2000).save(IMAGES / f"{name}.jpg", quality=88, optimize=True)
    panels = [opened(captures / f"{name}.png") for name in ("viewer_sample_d_lad", "ground_truth_sample_d_lad", "explanation_sample_d_lad")]
    side_by_side(panels, 1300, 28).save(IMAGES / "sample_d_explained.jpg", quality=88, optimize=True)
    side_by_side([opened(PLOTS / "cad_roc.png"), opened(PLOTS / "lcx_roc.png")], 860, 24).save(IMAGES / "roc_cad_lcx.png", optimize=True)
    print(f"  figures written to {IMAGES.relative_to(REPO)}")


# --- Markdown (the small subset the report uses) -> HTML --------------------------------------------


def inline(text: str) -> str:
    text = html.escape(text, quote=False).replace(" ± ", " ± ")  # a value and its ± stay on one line
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*([^*]+)\*(?![*\w])", r"<em>\1</em>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return re.sub(r"(?<![\"=>/\w])(https?://[^\s<)]*[^\s<).,])", r'<a href="\1">\1</a>', text)


def table(lines: list[str]) -> str:
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    head, body = rows[0], rows[2:]
    cls = ' class="wide"' if len(head) >= 8 else ""
    out = [f"<table{cls}><thead><tr>" + "".join(f"<th>{inline(cell)}</th>" for cell in head) + "</tr></thead><tbody>"]
    out += ["<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in row) + "</tr>" for row in body]
    return "".join(out) + "</tbody></table>"


def to_html(markdown: str) -> str:
    blocks = re.split(r"\n\s*\n", markdown.strip())
    out: list[str] = []
    width = "100%"
    index = 0
    first_paragraph = True
    while index < len(blocks):
        block = blocks[index].strip("\n")
        lines = block.split("\n")
        index += 1
        if block.startswith("```"):
            out.append(f"<pre><code>{html.escape(chr(10).join(lines[1:-1]))}</code></pre>")
        elif match := re.fullmatch(r"<!--\s*width:\s*([0-9]+%)\s*-->(?:\n(.*))?", block, re.S):
            width = match.group(1)
            if match.group(2):  # the image follows on the next line of the same block
                blocks[index - 1] = match.group(2)
                index -= 1
        elif match := re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", block):
            caption = ""
            if index < len(blocks) and blocks[index].lstrip().startswith("*Figure"):
                caption = f"<figcaption>{inline(blocks[index].strip().strip('*'))}</figcaption>"
                index += 1
            out.append(f'<figure style="width: {width}"><img src="{match.group(2)}" alt="{html.escape(match.group(1))}">{caption}</figure>')
            width = "100%"
        elif block.startswith("# "):
            out.append(f"<h1>{inline(block[2:])}</h1>")
        elif block.startswith("## "):
            out.append(f"<h2>{inline(block[3:])}</h2>")
        elif all(line.startswith("|") for line in lines) and len(lines) >= 2:
            out.append(table(lines))
        elif all(line.startswith("> ") for line in lines):
            out.append("<blockquote><p>" + inline(" ".join(line[2:] for line in lines)) + "</p></blockquote>")
        elif all(line.startswith("- ") for line in lines):
            out.append("<ul>" + "".join(f"<li>{inline(line[2:])}</li>" for line in lines) + "</ul>")
        elif all(re.match(r"\d+\. ", line) for line in lines):
            out.append("<ol>" + "".join(f"<li>{inline(re.sub(r'^\d+\. ', '', line))}</li>" for line in lines) + "</ol>")
        else:
            cls = ' class="meta"' if first_paragraph else ""
            first_paragraph = False
            out.append(f"<p{cls}>{inline(' '.join(lines))}</p>")
    return "\n".join(out)


# --- PDF -----------------------------------------------------------------------------------------


def find_browser(preferred: str | None) -> str:
    for candidate in ([preferred] if preferred else []) + list(BROWSERS):
        found = candidate if Path(candidate).is_file() else shutil.which(candidate)
        if found:
            return str(found)
    raise RuntimeError("No Edge or Chrome found; pass --browser with the path of a Chromium browser.")


def page_count(pdf: Path) -> int:
    return len(re.findall(rb"/Type\s*/Page(?![s\w])", pdf.read_bytes()))


def build(browser: str | None, captures: Path | None) -> int:
    if captures:
        compose_figures(captures)
    body = to_html(SOURCE.read_text(encoding="utf-8"))
    page = (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="{DOCS.as_uri()}/">'
        f"<title>CardioLens: project report</title><style>{STYLE}</style></head><body>{body}</body></html>"
    )
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "report.html"
        source.write_text(page, encoding="utf-8")
        subprocess.run(
            [
                find_browser(browser), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                f"--user-data-dir={Path(folder) / 'profile'}", f"--print-to-pdf={PDF}", source.as_uri(),
            ],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
        )
    pages = page_count(PDF)
    print(f"  wrote {PDF.relative_to(REPO)}: {pages} pages, {PDF.stat().st_size / 1e6:.2f} MB")
    if pages > MAX_PAGES:
        print(f"  the report must not be longer than {MAX_PAGES} pages")
        return 1
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--captures", type=Path, help="folder with the screenshots of capture_figures.mjs; rebuilds docs/images/")
    parser.add_argument("--browser", help="path of Edge or Chrome, if it is not found by itself")
    arguments = parser.parse_args()
    sys.exit(build(arguments.browser, arguments.captures))
