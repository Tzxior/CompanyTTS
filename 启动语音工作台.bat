@echo off
chcp 65001 >nul
title Qwen3-TTS ำ๏า๔นคื๗ฬจ
cd /d "D:\CompanyTTS"
"Qwen3TTS\.venv\Scripts\python.exe" "voice_workbench.py"
if errorlevel 1 pause
