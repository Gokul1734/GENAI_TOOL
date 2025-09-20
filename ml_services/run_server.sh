#!/bin/bash
# Activate Python venv and run FastAPI server
source mlenv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
