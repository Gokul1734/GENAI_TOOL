# Install dependencies for FactSense AI
mlenv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install fastapi uvicorn newspaper3k trafilatura pytesseract argostranslate openai-whisper sentence-transformers networkx langdetect
