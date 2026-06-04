@echo off
title Automotive Bots Launcher

echo Starting Tesla Data Extractor...
start "Bot - Tesla Live Extractor" cmd /k "cd /d "%~dp0Bot" && python -u tesla_data_extractor.py"

echo Starting BMW Data Collector...
start "Bot - BMW Data Collector" cmd /k "cd /d "%~dp0Bot" && python -u BMW_Data_Collector.py"

exit
