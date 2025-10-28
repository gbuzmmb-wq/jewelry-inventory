@echo off
echo ========================================
echo   Первая настройка GitHub
echo ========================================
echo.

echo Введите ваш GitHub nickname:
set /p nickname=Nickname: 

echo.
echo Введите имя репозитория (или нажмите Enter для "jewelry-inventory"):
set /p reponame=Имя репозитория: 
if "%reponame%"=="" set reponame=jewelry-inventory

echo.
echo Инициализация git...
git init

echo.
echo Добавление всех файлов...
git add .

echo.
echo Создание первого коммита...
git commit -m "Initial commit - Jewelry Inventory App"

echo.
echo Переименование ветки в main...
git branch -M main

echo.
echo Добавление remote origin...
git remote add origin https://github.com/%nickname%/%reponame%.git

echo.
echo ========================================
echo   Отправка на GitHub...
echo   Если попросит логин - используйте GitHub Desktop
echo   или создайте Personal Access Token
echo ========================================
echo.

git push -u origin main

echo.
echo ========================================
echo   Готово!
echo   Ваше приложение: https://%nickname%.github.io/%reponame%/
echo   (включите GitHub Pages в настройках)
echo ========================================
pause

