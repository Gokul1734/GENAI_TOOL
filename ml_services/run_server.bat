@echo off
REM Activate Python venv and run FastAPI server
call mlenv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
