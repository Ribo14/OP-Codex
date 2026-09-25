"""Estrae le FAQ ufficiali delle carte dai PDF di Bandai (RIB-44).

Legge docs/Regole One Piece Card/FAQ/*.pdf e scrive catalog-sync/faq/faq-raw.json: una voce per
riga della tabella "Card No. / Card Name / Question / Answer", con il testo così com'è nel PDF
(a capo compresi). Pulizia, raggruppamento per Card Code e caricamento nel database li fa
catalog-sync/sync-faqs.ts, in TypeScript e con i test.

Serve un'estrazione a tabella: con pdftotext la colonna del Card Code non è allineata alle
domande. Uso (dalla radice del repo):

    python -m venv .venv-faq
    .venv-faq/Scripts/python -m pip install -r scripts/faq/requirements.txt   (Windows)
    .venv-faq/Scripts/python scripts/faq/extract_faqs.py
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "docs" / "Regole One Piece Card" / "FAQ"
OUT = ROOT / "catalog-sync" / "faq" / "faq-raw.json"
HEADER = "Card No."
CARD_CODE = re.compile(r"^[A-Z]+\d*-\d{3}$")


def extract(pdf_path: Path) -> list[dict]:
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                for row in table:
                    cells = [(cell or "").strip() for cell in row]
                    if not any(cells) or cells[0] == HEADER:
                        continue
                    if len(cells) != 4 or not CARD_CODE.match(cells[0]):
                        raise ValueError(f"{pdf_path.name} p. {page_number}: riga inattesa {cells}")
                    code, name, question, answer = cells
                    if not question or not answer:
                        # Esiste nei PDF ufficiali (EB04-038 in qa_op14_eb04.pdf): riga vuota.
                        print(f"  riga senza domanda o risposta saltata: {pdf_path.name} p. {page_number} {code}")
                        continue
                    rows.append(
                        {
                            "source": pdf_path.name,
                            "page": page_number,
                            "cardCode": code,
                            "cardName": name,
                            "question": question,
                            "answer": answer,
                        }
                    )
    return rows


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"Nessun PDF in {PDF_DIR}")
    rows = []
    for pdf_path in pdfs:
        found = extract(pdf_path)
        print(f"{pdf_path.name}: {len(found)}")
        rows.extend(found)
    # Facoltativo: un altro file di uscita (primo argomento).
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Totale: {len(rows)} domande da {len(pdfs)} PDF -> {out}")


if __name__ == "__main__":
    main()
