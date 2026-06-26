@echo off
cd /d %~dp0
if exist ..\gh-pages-temp rd /s /q ..\gh-pages-temp
mkdir ..\gh-pages-temp
xcopy dist ..\gh-pages-temp /E /I /Y >nul
cd /d ..\gh-pages-temp
rmdir /s /q .git 2>nul
git init
if not exist .git rd /s /q .git
git remote add origin https://github.com/hshuwaikh-lab/LAZEO-StoreKSA.git
git checkout /B gh-pages-deploy
git add .
git commit -m "Deploy site to gh-pages"
git push --force origin gh-pages-deploy:gh-pages
