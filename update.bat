@echo off
echo ========================================
echo   Обновление проекта на GitHub
echo ========================================
echo.

:: Проверка наличия .git
if not exist ".git\" (
    echo Ошибка: Это не git репозиторий!
    echo Сначала выполните: git init
    pause
    exit /b 1
)

:: Добавить все изменения
git add .

:: Создать коммит
set /p message="Введите описание изменений (или нажмите Enter для автоописания): "
if "%message%"=="" set message=Update %date% %time%

git commit -m "%message%"

:: Отправить на GitHub
echo.
echo Отправка на GitHub...
git push

echo.
echo ========================================
echo   Готово! Изменения загружены!
echo ========================================
pause

