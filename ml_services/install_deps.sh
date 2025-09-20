#!/bin/bash
# Install dependencies for FactSense AI
source mlenv/bin/activate
python -m pip install --upgrade pip
pip install fastapi uvicorn newspaper3k trafilatura pytesseract argostranslate openai-whisper sentence-transformers networkx langdetect
