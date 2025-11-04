// Jewelry Inventory Management App
// Main Application Logic

class JewelryApp {
    constructor() {
        this.products = [];
        this.currentEditId = null;
        this.charts = {};
        this.pendingSaleId = null; // Store product ID waiting for payment type
        this.pendingConfirmAction = null; // Store function to execute on confirm
        this.githubToken = null; // GitHub token for sync
        this.gistId = null; // Gist ID for storing data
        this.syncEnabled = false; // Is sync enabled
        this.init();
    }

    async init() {
        this.loadSyncSettings();
        await this.loadData(); // Wait for data to load
        this.setupEventListeners();
        this.initTabs();
        this.initCharts();
        this.setupModalListeners();
        this.setupTableSorting();
    }

    // Load sync settings
    loadSyncSettings() {
        this.githubToken = localStorage.getItem('githubToken');
        this.gistId = localStorage.getItem('gistId');
        this.syncEnabled = localStorage.getItem('syncEnabled') === 'true';
        
        // Auto-setup with provided token if not configured
        if (!this.githubToken && !this.syncEnabled) {
            // Try to use token from URL parameter (if provided for initial setup)
            const urlParams = new URLSearchParams(window.location.search);
            const tokenParam = urlParams.get('token');
            if (tokenParam) {
                this.githubToken = tokenParam;
                this.syncEnabled = true;
                this.saveSyncSettings();
                // Remove token from URL for security
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }

    // Save sync settings
    saveSyncSettings() {
        if (this.githubToken) {
            localStorage.setItem('githubToken', this.githubToken);
        }
        if (this.gistId) {
            localStorage.setItem('gistId', this.gistId);
        }
        localStorage.setItem('syncEnabled', this.syncEnabled.toString());
    }

    // Load data from localStorage or GitHub
    async loadData() {
        // First try to load from localStorage (fast)
        const localData = localStorage.getItem('jewelryProducts');
        console.log(`📂 Загрузка из localStorage:`, localData ? `${localData.length} символов` : 'пусто');
        console.log(`📂 Содержимое:`, localData);
        
        const hasLocalData = localData && localData !== '[]' && localData !== 'null' && localData.trim() !== '';
        
        if (hasLocalData) {
            try {
                const parsed = JSON.parse(localData);
                console.log(`📂 Парсинг localStorage:`, typeof parsed, Array.isArray(parsed) ? `массив длиной ${parsed.length}` : 'не массив');
                
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.products = parsed.map(item => ({
                        ...item,
                        date: item.date || new Date().toISOString().split('T')[0],
                        saleDate: item.saleDate || null,
                        // Убеждаемся что новые поля есть
                        shipmentDate: item.shipmentDate || null,
                        shipmentAmount: item.shipmentAmount || 0,
                        expenses: item.expenses || 0,
                        isReturn: item.isReturn || false,
                        returnDate: item.returnDate || null,
                        returnAmount: item.returnAmount || 0
                    }));
                    console.log(`✅ Загружено ${this.products.length} товаров из localStorage`);
                } else {
                    console.log(`⚠️ localStorage содержит пустой массив или не массив`);
                    this.products = [];
                }
            } catch (e) {
                console.error('❌ Ошибка парсинга localStorage:', e);
                console.error('❌ Содержимое:', localData);
                this.products = [];
            }
        } else {
            console.log(`⚠️ localStorage пустой или содержит пустой массив`);
            this.products = [];
        }

        // Render immediately with local data (if any)
        this.renderProducts();
        this.updateStatistics();
        
            console.log(`📊 Загружено из localStorage: ${this.products.length} товаров`);
            
            // КРИТИЧНО: Рендерим товары сразу после загрузки из localStorage
            if (this.products.length > 0) {
                console.log(`🖼️ СРАЗУ после загрузки из localStorage: ${this.products.length} товаров`);
                console.log(`🖼️ Вызываю renderProducts немедленно...`);
                this.renderProducts();
                this.updateStatistics();
            }

        // If sync is enabled, try to load from GitHub
        if (this.syncEnabled && this.githubToken) {
            if (this.gistId) {
                // We have gistId, sync from GitHub
                // Only sync if local data is empty OR if we want to merge
                if (this.products.length === 0) {
                    console.log('📥 Локальные данные пустые, загружаю с GitHub...');
                    // Load immediately, don't wait
                    this.syncFromGitHub(true).then(() => {
                        // Force re-render after sync
                        this.renderProducts();
                        this.updateStatistics();
                    }).catch(err => {
                        console.error('Sync error on load:', err);
                    });
                } else {
                    console.log(`📊 Локальные данные есть (${this.products.length} товаров), синхронизация в фоне...`);
                    // Sync in background to merge, but don't overwrite local data
                    setTimeout(() => {
                        console.log(`🔄 Начинаю синхронизацию в фоне...`);
                        this.syncFromGitHub(true).then((result) => {
                            console.log(`🔄 Синхронизация завершена, результат: ${result}`);
                            console.log(`🔄 Товаров после синхронизации: ${this.products.length}`);
                            console.log(`🔄 Вызываю renderProducts...`);
                            this.renderProducts();
                            this.updateStatistics();
                            
                            // Проверка что товары отобразились
                            setTimeout(() => {
                                const tbody = document.getElementById('products-tbody');
                                if (tbody) {
                                    const rows = tbody.querySelectorAll('tr');
                                    console.log(`✅ Проверка после фоновой синхронизации: ${rows.length} строк в таблице`);
                                }
                            }, 200);
                        }).catch(err => {
                            console.error('Ошибка фоновой синхронизации:', err);
                        });
                    }, 1000);
                }
            } else {
                // No gistId yet - if no local data, try to find existing gist
                // Otherwise, create gist on first save
                if (!hasLocalData) {
                    console.log('No local data and no gistId, will create gist on first save');
                } else {
                    console.log('Has local data but no gistId, will create gist on first save');
                }
            }
        }
    }

    // Check sync on page load
    async checkSyncOnLoad() {
        // This is now handled in loadData
    }

    // Save data to localStorage and optionally to GitHub
    async saveData() {
        const productsCount = this.products ? this.products.length : 0;
        console.log(`💾 saveData вызван: ${productsCount} товаров`);
        console.log(`💾 Данные для сохранения:`, JSON.stringify(this.products).substring(0, 200));
        
        // Проверка что products это массив
        if (!Array.isArray(this.products)) {
            console.error(`❌ ОШИБКА: this.products не массив! Тип: ${typeof this.products}`, this.products);
            this.products = [];
        }
        
        const dataToSave = JSON.stringify(this.products);
        console.log(`💾 Данные для localStorage: ${dataToSave.length} символов`);
        localStorage.setItem('jewelryProducts', dataToSave);
        console.log(`✅ Данные сохранены в localStorage: ${productsCount} товаров`);
        
        // Проверка что сохранилось
        const saved = localStorage.getItem('jewelryProducts');
        console.log(`✅ Проверка сохранения: ${saved ? saved.length : 0} символов`);
        console.log(`✅ Проверка содержимого:`, saved);
        
        // Auto-sync to GitHub if enabled
        if (this.syncEnabled && this.githubToken) {
            console.log(`🔄 Синхронизация включена, отправка на GitHub...`);
            console.log(`🔄 Текущие товары перед синхронизацией:`, this.products.length);
            await this.syncToGitHub();
        } else {
            console.log(`⚠️ Синхронизация выключена или нет токена (syncEnabled=${this.syncEnabled}, hasToken=${!!this.githubToken})`);
        }
    }

    // Sync to GitHub Gist
    async syncToGitHub() {
        if (!this.githubToken) {
            console.error('GitHub token not set');
            return false;
        }

        try {
            // Детальная проверка перед синхронизацией
            console.log(`🔍 Проверка перед синхронизацией:`);
            console.log(`  - this.products:`, this.products);
            console.log(`  - Тип:`, typeof this.products);
            console.log(`  - Это массив:`, Array.isArray(this.products));
            console.log(`  - Длина:`, this.products ? this.products.length : 'null/undefined');
            
            const productsCount = this.products ? this.products.length : 0;
            console.log(`📤 Синхронизация на GitHub: ${productsCount} товаров`);
            
            if (productsCount === 0) {
                console.warn('⚠️ Нет данных для синхронизации (products пустой)');
                console.warn('⚠️ Проверка localStorage:', localStorage.getItem('jewelryProducts'));
                // НЕ отправляем пустой массив - это перезапишет данные на GitHub
                console.warn('⚠️ Пропускаю отправку пустого массива, чтобы не перезаписать данные на GitHub');
                return false;
            }

            const data = JSON.stringify(this.products, null, 2);
            console.log(`📤 Данные для отправки: ${data.length} символов`);
            console.log(`📤 Первые 300 символов:`, data.substring(0, 300));
            const filename = 'jewelry-inventory.json';
            
            let gistData = {
                description: 'Ювелирный учет - синхронизация данных',
                public: false,
                files: {
                    [filename]: {
                        content: data
                    }
                }
            };

            const url = this.gistId 
                ? `https://api.github.com/gists/${this.gistId}`
                : 'https://api.github.com/gists';
            
            const method = this.gistId ? 'PATCH' : 'POST';
            
            console.log(`📤 Отправка на GitHub: ${method} ${url.substring(0, 50)}...`);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub API error:', response.status, errorText);
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const result = await response.json();
            
            // Save Gist ID if this is first time
            if (!this.gistId && result.id) {
                this.gistId = result.id;
                this.saveSyncSettings();
                console.log(`✅ Gist создан: ${result.id}`);
            } else if (this.gistId) {
                console.log(`✅ Gist обновлен: ${this.gistId}`);
            }
            
            console.log(`✅ Данные синхронизированы: ${productsCount} товаров на GitHub`);

            // Уведомления отключены
            // this.showSyncNotification('✅ Данные синхронизированы с GitHub', 'success');
            return true;
        } catch (error) {
            console.error('Sync error:', error);
            // Уведомления отключены
            // this.showSyncNotification('❌ Ошибка синхронизации: ' + error.message, 'danger');
            return false;
        }
    }

    // Sync from GitHub Gist
    async syncFromGitHub(silent = false) {
        if (!this.githubToken || !this.gistId) {
            return false;
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Gist not found, create new one on next save
                    this.gistId = null;
                    localStorage.removeItem('gistId');
                    return false;
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const gist = await response.json();
            const filename = 'jewelry-inventory.json';
            const file = gist.files[filename];

            if (file && file.content) {
                console.log(`📥 Получены данные с GitHub, размер: ${file.content.length} символов`);
                console.log(`📥 Первые 200 символов: ${file.content.substring(0, 200)}`);
                console.log(`📥 Полное содержимое:`, file.content);
                
                let remoteData;
                try {
                    remoteData = JSON.parse(file.content);
                    console.log(`📥 Парсинг успешен, тип:`, typeof remoteData, Array.isArray(remoteData) ? 'массив' : 'не массив');
                    console.log(`📥 Длина массива:`, Array.isArray(remoteData) ? remoteData.length : 'не массив');
                } catch (parseError) {
                    console.error(`❌ Ошибка парсинга JSON:`, parseError);
                    console.error(`❌ Содержимое:`, file.content);
                    return false;
                }
                
                // Smart merge: use remote data if it's newer or has more items
                if (remoteData && Array.isArray(remoteData)) {
                    const localData = this.products || [];
                    
                    const localCount = localData.length;
                    const remoteCount = remoteData.length;
                    
                    console.log(`Sync: Local=${localCount}, Remote=${remoteCount}`);
                    
                    // If remote is empty AND local has data, keep local (don't overwrite)
                    if (remoteCount === 0 && localCount > 0) {
                        console.log('⚠️ Remote is empty but local has data, keeping local');
                        return false; // Don't update, keep local
                    }
                    
                    // If remote has data, use it (even if local is empty)
                    if (remoteCount > 0) {
                        console.log(`✅ Remote has ${remoteCount} items, loading...`);
                        // Create maps for efficient lookup
                        const localMap = localData ? new Map() : null;
                        if (localMap && localData) {
                            localData.forEach(item => {
                                localMap.set(item.id, item);
                            });
                        }
                        
                        const remoteMap = new Map();
                        remoteData.forEach(item => {
                            remoteMap.set(item.id, item);
                        });
                        
                        // Merge strategy:
                        // 1. Start with remote data (it's the source of truth from cloud)
                        // 2. Add local items that don't exist in remote (new local additions)
                        const merged = [...remoteData];
                        if (localData && localData.length > 0) {
                            localData.forEach(localItem => {
                                if (!remoteMap.has(localItem.id)) {
                                    // Local item not in remote, add it (might be new local addition)
                                    merged.push(localItem);
                                }
                            });
                        }
                        
                        console.log(`🔀 Объединено: ${merged.length} товаров (${remoteCount} с GitHub + ${merged.length - remoteCount} локальных)`);
                        
                        this.products = merged.map(item => ({
                            ...item,
                            date: item.date || new Date().toISOString().split('T')[0],
                            saleDate: item.saleDate || null
                        }));
                        
                        console.log(`💾 Сохранение ${this.products.length} товаров в localStorage...`);
                        console.log(`💾 Данные для сохранения:`, JSON.stringify(this.products));
                        // Save merged data to localStorage
                        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
                        console.log(`✅ Сохранено в localStorage`);
                        
                        // Проверка что сохранилось
                        const checkSaved = localStorage.getItem('jewelryProducts');
                        const checkParsed = checkSaved ? JSON.parse(checkSaved) : [];
                        console.log(`✅ Проверка: ${checkParsed.length} товаров в localStorage`);
                        console.log(`✅ Проверка содержимого:`, checkParsed);
                        
                        // Force render - especially important on mobile
                        console.log(`🖼️ Рендеринг товаров...`);
                        console.log(`🖼️ this.products перед рендером:`, this.products);
                        console.log(`🖼️ this.products.length:`, this.products.length);
                        
                        // Убедимся что данные точно есть перед рендером
                        if (this.products && this.products.length > 0) {
                            console.log(`✅ Вызываю renderProducts с ${this.products.length} товарами`);
                            this.renderProducts();
                            this.updateStatistics();
                        } else {
                            console.error(`❌ ОШИБКА: this.products пустой перед рендером!`);
                        }
                        
                        // Double render after a bit for safety
                        setTimeout(() => {
                            console.log(`🖼️ Повторный рендеринг через 500мс...`);
                            console.log(`🖼️ this.products перед повторным рендером:`, this.products);
                            console.log(`🖼️ this.products.length:`, this.products.length);
                            
                            if (this.products && this.products.length > 0) {
                                console.log(`✅ Вызываю renderProducts повторно с ${this.products.length} товарами`);
                                this.renderProducts();
                                this.updateStatistics();
                                
                                // Проверка что товары отобразились
                                const tbody = document.getElementById('products-tbody');
                                if (tbody) {
                                    const rows = tbody.querySelectorAll('tr');
                                    console.log(`✅ Проверка: ${rows.length} строк в таблице после рендера`);
                                    
                                    if (rows.length === 0) {
                                        console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Товары не отображаются!`);
                                        console.error(`❌ this.products:`, this.products);
                                        console.error(`❌ tbody.innerHTML length:`, tbody.innerHTML.length);
                                    }
                                }
                            } else {
                                console.error(`❌ ОШИБКА: this.products пустой при повторном рендере!`);
                            }
                        }, 500);
                        
                        console.log(`✅ Данные загружены и отображены: ${merged.length} товаров`);
                        console.log(`📊 Товары после загрузки:`, this.products.map(p => `${p.name} (${p.id})`));
                        
                        // Уведомления отключены
                        // if (!silent) {
                        //     this.showSyncNotification(`✅ Загружено ${remoteCount} товаров с GitHub`, 'success');
                        // }
                        return true;
                    } else {
                        console.log(`⚠️ Remote data is empty array`);
                    }
                } else {
                    console.log(`⚠️ Remote data is not an array:`, typeof remoteData, remoteData);
                }
            } else {
                console.log('⚠️ Gist file exists but has no content or file not found');
                if (gist.files) {
                    console.log('Gist files:', Object.keys(gist.files));
                }
            }
        } catch (error) {
            console.error('Sync from GitHub error:', error);
            // Уведомления отключены
            // if (!silent) {
            //     this.showSyncNotification('❌ Ошибка загрузки: ' + error.message, 'danger');
            // }
            return false;
        }
    }

    // Show sync notification
    showSyncNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.getElementById('sync-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'sync-notification';
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Open sync settings modal
    openSyncSettings() {
        try {
            // Close dropdown menu first
            const dropdown = document.querySelector('.dropdown-menu.show');
            if (dropdown) {
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdown.previousElementSibling || dropdown.parentElement);
                if (dropdownInstance) {
                    dropdownInstance.hide();
                }
            }

            const modalElement = document.getElementById('syncModal');
            if (!modalElement) {
                console.error('Sync modal not found');
                alert('Ошибка: Модальное окно не найдено. Обновите страницу.');
                return;
            }

            // Fill form with current settings
            const tokenInput = document.getElementById('sync-token');
            const enabledCheckbox = document.getElementById('sync-enabled');
            
            if (tokenInput) {
                tokenInput.value = this.githubToken || '';
            } else {
                console.error('sync-token input not found');
            }
            
            if (enabledCheckbox) {
                enabledCheckbox.checked = this.syncEnabled;
            } else {
                console.error('sync-enabled checkbox not found');
            }

            // Show status
            const statusEl = document.getElementById('sync-status');
            if (statusEl) {
                if (this.syncEnabled && this.githubToken) {
                    statusEl.innerHTML = '<span class="badge bg-success">Синхронизация включена</span>';
                } else {
                    statusEl.innerHTML = '<span class="badge bg-secondary">Синхронизация выключена</span>';
                }
            }

            // Show modal - wait a bit for dropdown to close
            setTimeout(() => {
                try {
                    let modal = bootstrap.Modal.getInstance(modalElement);
                    if (!modal) {
                        modal = new bootstrap.Modal(modalElement, {
                            backdrop: true,
                            keyboard: true,
                            focus: true
                        });
                    }
                    modal.show();
                } catch (modalError) {
                    console.error('Modal error:', modalError);
                    alert('Ошибка при открытии модального окна: ' + modalError.message);
                }
            }, 150);
        } catch (error) {
            console.error('Error opening sync settings:', error);
            alert('Ошибка при открытии настроек синхронизации: ' + error.message);
        }
    }

    // Save sync settings
    saveSyncSettingsFromForm() {
        const token = document.getElementById('sync-token').value.trim();
        const enabled = document.getElementById('sync-enabled').checked;

        if (enabled && !token) {
            alert('Введите GitHub токен для включения синхронизации!');
            return;
        }

        this.githubToken = token || null;
        this.syncEnabled = enabled;
        this.saveSyncSettings();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('syncModal'));
        modal.hide();

        // If enabled, sync immediately
        if (enabled && token) {
            this.syncToGitHub().then(() => {
                // Уведомления отключены
                // this.showSyncNotification('✅ Синхронизация настроена и выполнена', 'success');
            });
        } else {
            // Уведомления отключены
            // this.showSyncNotification('✅ Настройки синхронизации сохранены', 'info');
        }
    }

    // Manual sync
    async manualSync() {
        if (!this.syncEnabled || !this.githubToken) {
            alert('Сначала включите синхронизацию в настройках!');
            this.openSyncSettings();
            return;
        }

        console.log(`🔄 Ручная синхронизация:`);
        console.log(`  - Товаров в памяти: ${this.products.length}`);
        console.log(`  - Товары:`, this.products);
        
        // Уведомления отключены
        // this.showSyncNotification('🔄 Синхронизация...', 'info');
        
        // First sync to GitHub (upload) - только если есть данные
        if (this.products && this.products.length > 0) {
            console.log(`📤 Отправка ${this.products.length} товаров на GitHub...`);
            await this.syncToGitHub();
        } else {
            console.log(`⚠️ Нет данных для отправки, пропускаю upload`);
        }
        
        // Then sync from GitHub (download)
        console.log(`📥 Загрузка данных с GitHub...`);
        await this.syncFromGitHub();
        
        this.renderProducts();
        this.updateStatistics();
    }

    // Setup event listeners
    setupEventListeners() {
        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });

        // Status filter
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filterProducts(document.getElementById('search-input').value, e.target.value);
        });

        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    // Setup modal listeners
    setupModalListeners() {
        const modal = document.getElementById('productModal');
        const statusSelect = document.getElementById('product-status');
        const isReturnCheckbox = document.getElementById('product-is-return');

        statusSelect.addEventListener('change', () => {
            const isSold = statusSelect.value === 'sold';
            document.getElementById('payment-type-container').style.display = isSold ? 'block' : 'none';
            document.getElementById('sale-date-container').style.display = isSold ? 'block' : 'none';
        });

        // Показ/скрытие полей возврата
        if (isReturnCheckbox) {
            isReturnCheckbox.addEventListener('change', () => {
                const returnContainer = document.getElementById('return-details-container');
                if (returnContainer) {
                    returnContainer.style.display = isReturnCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        modal.addEventListener('hidden.bs.modal', () => {
            this.resetForm();
        });
    }

    // Switch tabs
    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');

        // Show/hide tab content
        document.getElementById('products-tab').classList.toggle('d-none', tabName !== 'products');
        document.getElementById('analytics-tab').classList.toggle('d-none', tabName !== 'analytics');

        // Update charts if switching to analytics
        if (tabName === 'analytics') {
            this.updateCharts();
        }
    }

    // Initialize tabs
    initTabs() {
        // Set default active tab
        document.querySelector('[data-tab="products"]').classList.add('active');
    }

    // Open product modal
    openProductModal(productId = null) {
        this.currentEditId = productId;
        const modalElement = document.getElementById('productModal');

        if (!modalElement) {
            console.error('Modal element not found');
            return;
        }

        // Check if modal already exists
        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            modal = new bootstrap.Modal(modalElement);
        }

        if (productId) {
            // Edit mode
            const product = this.products.find(p => p.id === productId);
            if (product) {
                modalElement.querySelector('.modal-title').textContent = 'Редактировать товар';

                // Fill form immediately
                document.getElementById('product-id').value = product.id;
                document.getElementById('product-date').value = product.date;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-weight').value = product.weight;
                document.getElementById('product-article').value = product.article;
                document.getElementById('product-purchase-price').value = product.purchasePrice;
                document.getElementById('product-selling-price').value = product.sellingPrice;
                document.getElementById('product-status').value = product.status;
                // Устанавливаем тип оплаты с проверкой на поддерживаемые значения
                const paymentTypeSelect = document.getElementById('product-payment-type');
                const validPaymentTypes = ['cash', 'cashless', 'installment'];
                const paymentType = product.paymentType && validPaymentTypes.includes(product.paymentType) 
                    ? product.paymentType 
                    : 'cash';
                if (paymentTypeSelect) {
                    paymentTypeSelect.value = paymentType;
                }
                document.getElementById('product-sale-date').value = product.saleDate || '';
                
                // Новые поля
                document.getElementById('product-shipment-date').value = product.shipmentDate || '';
                document.getElementById('product-shipment-amount').value = product.shipmentAmount || 0;
                document.getElementById('product-expenses').value = product.expenses || 0;
                document.getElementById('product-is-return').checked = product.isReturn || false;
                document.getElementById('product-return-date').value = product.returnDate || '';
                document.getElementById('product-return-amount').value = product.returnAmount || 0;
                
                // Показываем поля возврата если нужно
                const returnContainer = document.getElementById('return-details-container');
                if (returnContainer) {
                    returnContainer.style.display = (product.isReturn) ? 'block' : 'none';
                }

                // Show payment type and sale date if sold
                if (product.status === 'sold') {
                    document.getElementById('payment-type-container').style.display = 'block';
                    document.getElementById('sale-date-container').style.display = 'block';
                }
            }
            modal.show();
        } else {
            // Add mode
            modalElement.querySelector('.modal-title').textContent = 'Добавить товар';
            document.getElementById('productForm').reset();
            document.getElementById('product-date').value = new Date().toISOString().split('T')[0];
            modal.show();

            // Wait for modal to show before triggering change
            setTimeout(() => {
                document.getElementById('product-status').dispatchEvent(new Event('change'));
            }, 100);
        }
    }

    // Save product
    saveProduct() {
        const form = document.getElementById('productForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const isReturn = document.getElementById('product-is-return')?.checked || false;
        const productData = {
            id: document.getElementById('product-id').value || this.generateId(),
            date: document.getElementById('product-date').value,
            name: document.getElementById('product-name').value,
            weight: parseFloat(document.getElementById('product-weight').value),
            article: document.getElementById('product-article').value,
            purchasePrice: parseFloat(document.getElementById('product-purchase-price').value),
            sellingPrice: parseFloat(document.getElementById('product-selling-price').value),
            status: document.getElementById('product-status').value,
            paymentType: document.getElementById('product-status').value === 'sold'
                ? document.getElementById('product-payment-type').value
                : null,
            saleDate: document.getElementById('product-status').value === 'sold'
                ? document.getElementById('product-sale-date').value
                : null,
            // Новые поля
            shipmentDate: document.getElementById('product-shipment-date')?.value || null,
            shipmentAmount: parseFloat(document.getElementById('product-shipment-amount')?.value || 0),
            expenses: parseFloat(document.getElementById('product-expenses')?.value || 0),
            isReturn: isReturn,
            returnDate: isReturn ? (document.getElementById('product-return-date')?.value || null) : null,
            returnAmount: isReturn ? parseFloat(document.getElementById('product-return-amount')?.value || 0) : 0
        };

        if (this.currentEditId) {
            // Update existing
            const index = this.products.findIndex(p => p.id === this.currentEditId);
            if (index !== -1) {
                this.products[index] = productData;
                console.log(`✏️ Товар обновлен: ${productData.name}`);
            } else {
                console.warn(`⚠️ Товар с ID ${this.currentEditId} не найден для обновления`);
            }
        } else {
            // Add new
            this.products.push(productData);
            console.log(`➕ Товар добавлен: ${productData.name} (ID: ${productData.id})`);
        }

        console.log(`📊 Всего товаров в массиве: ${this.products.length}`);
        console.log(`📦 Данные товара:`, productData);

        // Проверка что товар действительно добавлен
        console.log(`🔍 Проверка после добавления:`);
        console.log(`  - Длина массива: ${this.products.length}`);
        console.log(`  - Последний товар:`, this.products[this.products.length - 1]);
        console.log(`  - Все товары:`, this.products);
        
        // Render immediately (don't wait for save)
        this.renderProducts();
        this.updateStatistics();
        
        // Save data (async, but wait for it)
        console.log(`💾 Сохранение товара: ${this.products.length} товаров в списке`);
        console.log(`💾 Товары перед сохранением:`, JSON.stringify(this.products));
        
        this.saveData().then(() => {
            console.log(`✅ Данные сохранены: ${this.products.length} товаров`);
            // Проверка что действительно сохранилось
            const saved = localStorage.getItem('jewelryProducts');
            const savedParsed = saved ? JSON.parse(saved) : [];
            console.log(`✅ Проверка после сохранения: ${savedParsed.length} товаров в localStorage`);
        }).catch(err => {
            console.error('❌ Ошибка сохранения данных:', err);
        });

        this.resetForm();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        modal.hide();
    }

    // Delete product
    deleteProduct(id) {
        // Store action to execute
        this.pendingConfirmAction = () => {
            this.products = this.products.filter(p => p.id !== id);
            this.saveData();
            this.renderProducts();
            this.updateStatistics();
        };

        // Show confirm modal
        document.getElementById('confirmMessage').textContent = 'Вы уверены, что хотите удалить этот товар?';
        const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
        modal.show();
    }

    // Mark as sold
    markAsSold(id) {
        // Store product ID and show payment type modal
        this.pendingSaleId = id;

        const modalElement = document.getElementById('paymentTypeModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }

    // Confirm payment type
    confirmPaymentType(paymentType) {
        if (!this.pendingSaleId) return;

        const product = this.products.find(p => p.id === this.pendingSaleId);
        if (product) {
            product.status = 'sold';
            product.saleDate = new Date().toISOString().split('T')[0];
            product.paymentType = paymentType;
            this.saveData();
            this.renderProducts();
            this.updateStatistics();
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('paymentTypeModal'));
        modal.hide();

        this.pendingSaleId = null;
    }

    // Revert sold status
    revertSoldStatus(id) {
        const product = this.products.find(p => p.id === id);
        if (product && product.status === 'sold') {
            // Store action to execute
            this.pendingConfirmAction = () => {
                product.status = 'in-stock';
                product.saleDate = null;
                product.paymentType = null;
                this.saveData();
                this.renderProducts();
                this.updateStatistics();
            };

            // Show confirm modal
            document.getElementById('confirmMessage').textContent = 'Отменить продажу этого товара?';
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            modal.show();
        }
    }

    // Mark product as returned
    markAsReturned(id) {
        const product = this.products.find(p => p.id === id);
        if (product && product.status === 'sold' && !product.isReturn) {
            product.isReturn = true;
            product.returnDate = new Date().toISOString().split('T')[0];
            // Если сумма возврата не указана, устанавливаем равной продажной цене
            if (!product.returnAmount || product.returnAmount === 0) {
                product.returnAmount = product.sellingPrice;
            }
            this.saveData();
            this.renderProducts();
            this.updateStatistics();
        }
    }

    // Revert returned status
    revertReturnedStatus(id) {
        const product = this.products.find(p => p.id === id);
        if (product && product.isReturn) {
            // Store action to execute
            this.pendingConfirmAction = () => {
                product.isReturn = false;
                product.returnDate = null;
                product.returnAmount = 0;
                this.saveData();
                this.renderProducts();
                this.updateStatistics();
            };

            // Show confirm modal
            document.getElementById('confirmMessage').textContent = 'Отменить возврат этого товара?';
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            modal.show();
        }
    }

    // Reset form
    resetForm() {
        document.getElementById('productForm').reset();
        this.currentEditId = null;
        document.getElementById('product-id').value = '';
        document.getElementById('product-date').value = new Date().toISOString().split('T')[0];
        
        // Сброс новых полей
        const shipmentAmountEl = document.getElementById('product-shipment-amount');
        const expensesEl = document.getElementById('product-expenses');
        const isReturnEl = document.getElementById('product-is-return');
        const returnAmountEl = document.getElementById('product-return-amount');
        const returnContainer = document.getElementById('return-details-container');
        
        if (shipmentAmountEl) shipmentAmountEl.value = 0;
        if (expensesEl) expensesEl.value = 0;
        if (isReturnEl) isReturnEl.checked = false;
        if (returnAmountEl) returnAmountEl.value = 0;
        if (returnContainer) returnContainer.style.display = 'none';
    }

    // Render products table
    renderProducts(products = this.products) {
        console.log(`🖼️ renderProducts вызван с ${products.length} товарами`);
        console.log(`🖼️ Товары для рендера:`, products);
        
        const tbody = document.getElementById('products-tbody');
        const noProducts = document.getElementById('no-products');

        if (!tbody) {
            console.error('❌ tbody не найден!');
            return;
        }

        if (products.length === 0) {
            console.log(`⚠️ Нет товаров для отображения, показываю пустое состояние`);
            tbody.innerHTML = '';
            if (noProducts) {
                noProducts.style.display = 'block';
            }
            this.setupTableSorting();
            return;
        }

        console.log(`✅ Рендеринг ${products.length} товаров`);
        if (noProducts) {
            noProducts.style.display = 'none';
        }
        
        const html = products.map((product, index) => {
            const profit = product.sellingPrice - product.purchasePrice;
            const isSold = product.status === 'sold';
            const isReturned = product.isReturn === true;
            const isCashSale = isSold && product.paymentType === 'cash';
            const isCardSale = isSold && product.paymentType === 'cashless';
            const isInstallmentSale = isSold && product.paymentType === 'installment';

            return `
                <tr data-id="${product.id}">
                    <td><strong>${index + 1}</strong></td>
                    <td>${this.formatDate(product.date)}</td>
                    <td><strong>${this.escapeHtml(product.name)}</strong></td>
                    <td data-sort="${product.weight}">${product.weight} гр</td>
                    <td><code>${this.escapeHtml(product.article)}</code></td>
                    <td data-sort="${product.purchasePrice}">${product.purchasePrice.toFixed(2)} ₽</td>
                    <td data-sort="${product.sellingPrice}">${product.sellingPrice.toFixed(2)} ₽</td>
                    <td class="text-center">
                        ${isCashSale ? '<i class="bi bi-check-circle-fill text-success" style="font-size: 1.5rem;"></i>' : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${isCardSale ? '<i class="bi bi-check-circle-fill text-success" style="font-size: 1.5rem;"></i>' : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${isInstallmentSale ? '<i class="bi bi-check-circle-fill text-warning" style="font-size: 1.5rem;"></i>' : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${product.shipmentDate ? `<small>${this.formatDate(product.shipmentDate)}</small><br><strong>${product.shipmentAmount > 0 ? product.shipmentAmount.toFixed(2) + ' ₽' : '-'}</strong>` : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${product.expenses > 0 ? `<strong class="text-danger">${product.expenses.toFixed(2)} ₽</strong>` : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${product.isReturn ? `<i class="bi bi-arrow-return-left text-warning" style="font-size: 1.5rem;" title="Возврат"></i><br><small>${product.returnDate ? this.formatDate(product.returnDate) : ''}</small><br><strong class="text-danger">${product.returnAmount > 0 ? product.returnAmount.toFixed(2) + ' ₽' : ''}</strong>` : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="action-buttons">
                        ${!isSold && !isReturned ? `
                            <button class="btn btn-sm btn-success" onclick="app.markAsSold('${product.id}')" title="Отметить как проданный">
                                <i class="bi bi-check-circle"></i>
                            </button>
                        ` : ''}
                        ${isSold && !isReturned ? `
                            <button class="btn btn-sm btn-warning" onclick="app.revertSoldStatus('${product.id}')" title="Отменить продажу">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-sm btn-info" onclick="app.markAsReturned('${product.id}')" title="Отметить как возвращенный">
                                <i class="bi bi-arrow-return-left"></i>
                            </button>
                        ` : ''}
                        ${isReturned ? `
                            <button class="btn btn-sm btn-warning" onclick="app.revertReturnedStatus('${product.id}')" title="Отменить возврат">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-primary" onclick="openProductModal('${product.id}')" title="Редактировать">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteProduct('${product.id}')" title="Удалить">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        console.log(`🖼️ Сгенерированный HTML: ${html.length} символов`);
        console.log(`🖼️ Первые 500 символов HTML:`, html.substring(0, 500));
        
        tbody.innerHTML = html;
        console.log(`✅ HTML вставлен в tbody`);
        
        // Проверка что товары действительно в DOM - сразу и через небольшую задержку
        setTimeout(() => {
            const renderedRows = tbody.querySelectorAll('tr');
            console.log(`✅ Проверка DOM: ${renderedRows.length} строк в таблице`);
            
            if (renderedRows.length === 0 && products.length > 0) {
                console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Товары не отображаются в таблице!`);
                console.error(`❌ products.length: ${products.length}`);
                console.error(`❌ tbody.innerHTML length: ${tbody.innerHTML.length}`);
                console.error(`❌ tbody.innerHTML:`, tbody.innerHTML.substring(0, 500));
                console.error(`❌ tbody element:`, tbody);
                
                // Попытка принудительного рендера
                console.log(`🔄 Попытка принудительного рендера...`);
                tbody.innerHTML = html; // Повторная вставка
                const retryRows = tbody.querySelectorAll('tr');
                console.log(`🔄 После повторной вставки: ${retryRows.length} строк`);
            } else if (renderedRows.length > 0) {
                console.log(`✅ Товары успешно отображены! ${renderedRows.length} строк`);
            }
        }, 100);
        
        // Также проверяем сразу
        const immediateRows = tbody.querySelectorAll('tr');
        console.log(`✅ Сразу после вставки: ${immediateRows.length} строк в таблице`);
        
        // Проверка видимости таблицы
        const table = tbody.closest('table');
        const tableContainer = table ? table.closest('.table-responsive') : null;
        if (table) {
            const tableStyle = window.getComputedStyle(table);
            console.log(`✅ Таблица найдена, видимость: ${tableStyle.display}, opacity: ${tableStyle.opacity}`);
            if (tableContainer) {
                const containerStyle = window.getComputedStyle(tableContainer);
                console.log(`✅ Контейнер таблицы: display=${containerStyle.display}, visibility=${containerStyle.visibility}`);
            }
        }
        
        // Проверка что no-products скрыт
        if (noProducts) {
            const noProductsStyle = window.getComputedStyle(noProducts);
            console.log(`✅ no-products элемент: display=${noProductsStyle.display}`);
            if (noProductsStyle.display !== 'none') {
                console.warn(`⚠️ ВНИМАНИЕ: no-products видим, но товары есть!`);
                noProducts.style.display = 'none';
            }
        }

        // Setup sorting after render
        this.setupTableSorting();
    }

    // Filter products
    filterProducts(searchTerm = '', statusFilter = 'all') {
        let filtered = this.products;

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.article.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'returned') {
                filtered = filtered.filter(p => p.isReturn === true);
            } else if (statusFilter === 'installment') {
                filtered = filtered.filter(p => p.status === 'sold' && p.paymentType === 'installment');
            } else {
                filtered = filtered.filter(p => p.status === statusFilter);
            }
        }

        this.renderProducts(filtered);
    }

    // Update statistics
    updateStatistics() {
        const totalProducts = this.products.length;
        const soldProducts = this.products.filter(p => p.status === 'sold').length;
        const inStock = totalProducts - soldProducts;

        // Прибыль = продажная цена - закупочная цена - расходы - возвраты
        const totalProfit = this.products
            .filter(p => p.status === 'sold')
            .reduce((sum, p) => {
                const profit = p.sellingPrice - p.purchasePrice;
                const expenses = p.expenses || 0;
                const returnAmount = (p.isReturn && p.returnAmount) ? p.returnAmount : 0;
                return sum + profit - expenses - returnAmount;
            }, 0);

        // Статистика по отправкам
        const totalShipments = this.products.filter(p => p.shipmentDate).length;
        
        // Общие расходы
        const totalExpenses = this.products.reduce((sum, p) => sum + (p.expenses || 0), 0);
        
        // Статистика по возвратам
        const totalReturns = this.products.filter(p => p.isReturn === true).length;
        const totalReturnAmount = this.products
            .filter(p => p.isReturn === true)
            .reduce((sum, p) => sum + (p.returnAmount || 0), 0);

        // Статистика по рассрочке
        const installmentProducts = this.products.filter(p => p.status === 'sold' && p.paymentType === 'installment');
        const installmentCount = installmentProducts.length;
        const installmentAmount = installmentProducts.reduce((sum, p) => sum + (p.sellingPrice || 0), 0);

        document.getElementById('total-products').textContent = totalProducts;
        document.getElementById('sold-products').textContent = soldProducts;
        document.getElementById('in-stock').textContent = inStock;
        document.getElementById('total-profit').textContent = totalProfit.toFixed(2) + ' ₽';
        document.getElementById('total-shipments').textContent = totalShipments;
        document.getElementById('total-expenses').textContent = totalExpenses.toFixed(2) + ' ₽';
        document.getElementById('total-returns').textContent = totalReturns;
        document.getElementById('total-return-amount').textContent = totalReturnAmount.toFixed(2) + ' ₽';
        document.getElementById('installment-count').textContent = installmentCount;
        document.getElementById('installment-amount').textContent = installmentAmount.toFixed(2) + ' ₽';
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Format date
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize charts
    initCharts() {
        // Payment type chart (donut)
        const paymentCtx = document.getElementById('paymentChart');
        this.charts.payment = new Chart(paymentCtx, {
            type: 'doughnut',
            data: {
                labels: ['Наличные', 'Безналичные'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#28a745', '#17a2b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Profit chart (line)
        const profitCtx = document.getElementById('profitChart');
        this.charts.profit = new Chart(profitCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Прибыль (₽)',
                    data: [],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Turnover chart (bar)
        const turnoverCtx = document.getElementById('turnoverChart');
        this.charts.turnover = new Chart(turnoverCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Приобретено',
                        data: [],
                        backgroundColor: 'rgba(212, 175, 55, 0.7)'
                    },
                    {
                        label: 'Продано',
                        data: [],
                        backgroundColor: 'rgba(40, 167, 69, 0.7)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Top products chart (horizontal bar)
        const topProductsCtx = document.getElementById('topProductsChart');
        this.charts.topProducts = new Chart(topProductsCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Прибыль (₽)',
                    data: [],
                    backgroundColor: 'rgba(139, 111, 71, 0.8)'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });
    }

    // Update charts
    updateCharts() {
        const soldProducts = this.products.filter(p => p.status === 'sold');

        // Payment type chart
        const cashCount = soldProducts.filter(p => p.paymentType === 'cash').length;
        const cashlessCount = soldProducts.filter(p => p.paymentType === 'cashless').length;
        this.charts.payment.data.datasets[0].data = [cashCount, cashlessCount];
        this.charts.payment.update();

        // Profit by month
        const profitByMonth = this.getProfitByMonth();
        this.charts.profit.data.labels = profitByMonth.months;
        this.charts.profit.data.datasets[0].data = profitByMonth.profits;
        this.charts.profit.update();

        // Turnover by month
        const turnoverByMonth = this.getTurnoverByMonth();
        this.charts.turnover.data.labels = turnoverByMonth.months;
        this.charts.turnover.data.datasets[0].data = turnoverByMonth.acquired;
        this.charts.turnover.data.datasets[1].data = turnoverByMonth.sold;
        this.charts.turnover.update();

        // Top products
        const topProducts = this.getTopProducts();
        this.charts.topProducts.data.labels = topProducts.names;
        this.charts.topProducts.data.datasets[0].data = topProducts.profits;
        this.charts.topProducts.update();
    }

    // Get profit by month
    getProfitByMonth() {
        const sold = this.products.filter(p => p.status === 'sold' && p.saleDate);
        const byMonth = {};

        sold.forEach(product => {
            const month = product.saleDate.substring(0, 7); // YYYY-MM
            if (!byMonth[month]) byMonth[month] = 0;
            byMonth[month] += (product.sellingPrice - product.purchasePrice);
        });

        const entries = Object.entries(byMonth).sort();
        return {
            months: entries.map(([month]) => new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })),
            profits: entries.map(([, profit]) => profit)
        };
    }

    // Get turnover by month
    getTurnoverByMonth() {
        const byMonth = {};
        this.products.forEach(product => {
            const month = product.date.substring(0, 7);
            if (!byMonth[month]) {
                byMonth[month] = { acquired: 0, sold: 0 };
            }
            byMonth[month].acquired++;
            if (product.status === 'sold' && product.saleDate) {
                const saleMonth = product.saleDate.substring(0, 7);
                if (!byMonth[saleMonth]) {
                    byMonth[saleMonth] = { acquired: 0, sold: 0 };
                }
                byMonth[saleMonth].sold++;
            }
        });

        const entries = Object.entries(byMonth).sort();
        return {
            months: entries.map(([month]) => new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short' })),
            acquired: entries.map(([, data]) => data.acquired),
            sold: entries.map(([, data]) => data.sold)
        };
    }

    // Get top products by profit
    getTopProducts() {
        const sold = this.products.filter(p => p.status === 'sold');
        const products = sold
            .map(p => ({
                name: p.name.substring(0, 20) + (p.name.length > 20 ? '...' : ''),
                profit: p.sellingPrice - p.purchasePrice
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);

        return {
            names: products.map(p => p.name),
            profits: products.map(p => p.profit)
        };
    }

    // Export data
    exportData() {
        const dataStr = JSON.stringify(this.products, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `jewelry_inventory_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Export to Excel
    async exportToExcel() {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Товары');

            // Заголовок отчета
            worksheet.mergeCells('A1:L1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'Ювелирный учет - Отчет по товарам';
            titleCell.font = { size: 16, bold: true, color: { argb: 'FF8B6F47' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5E6D3' }
            };
            worksheet.getRow(1).height = 30;

            // Дата отчета
            worksheet.mergeCells('A2:L2');
            const dateCell = worksheet.getCell('A2');
            dateCell.value = `Дата отчета: ${new Date().toLocaleDateString('ru-RU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}`;
            dateCell.font = { size: 11, italic: true };
            dateCell.alignment = { horizontal: 'center' };
            worksheet.getRow(2).height = 20;

            // Статистика
            const totalProducts = this.products.length;
            const soldProducts = this.products.filter(p => p.status === 'sold').length;
            const inStock = totalProducts - soldProducts;
            const totalProfit = this.products
                .filter(p => p.status === 'sold')
                .reduce((sum, p) => {
                    const profit = p.sellingPrice - p.purchasePrice;
                    const expenses = p.expenses || 0;
                    const returnAmount = (p.isReturn && p.returnAmount) ? p.returnAmount : 0;
                    return sum + profit - expenses - returnAmount;
                }, 0);
            const totalExpenses = this.products.reduce((sum, p) => sum + (p.expenses || 0), 0);
            const totalReturns = this.products.filter(p => p.isReturn === true).length;
            const totalReturnAmount = this.products
                .filter(p => p.isReturn === true)
                .reduce((sum, p) => sum + (p.returnAmount || 0), 0);
            const installmentCount = this.products.filter(p => p.status === 'sold' && p.paymentType === 'installment').length;
            const installmentAmount = this.products
                .filter(p => p.status === 'sold' && p.paymentType === 'installment')
                .reduce((sum, p) => sum + (p.sellingPrice || 0), 0);

            worksheet.mergeCells('A4:L4');
            const statsTitle = worksheet.getCell('A4');
            statsTitle.value = 'Статистика';
            statsTitle.font = { size: 14, bold: true };
            statsTitle.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8E8E8' }
            };
            worksheet.getRow(4).height = 25;

            // Статистические данные
            const statsData = [
                ['Всего товаров', totalProducts, 'Продано', soldProducts, 'В наличии', inStock],
                ['Прибыль', `${totalProfit.toFixed(2)} ₽`, 'Расходы', `${totalExpenses.toFixed(2)} ₽`, 'Возвраты', totalReturns],
                ['Сумма возвратов', `${totalReturnAmount.toFixed(2)} ₽`, 'Рассрочка (кол-во)', installmentCount, 'Сумма рассрочки', `${installmentAmount.toFixed(2)} ₽`]
            ];

            statsData.forEach((row, idx) => {
                const rowNum = 5 + idx;
                row.forEach((cell, colIdx) => {
                    const cellRef = worksheet.getCell(rowNum, colIdx * 2 + 1);
                    cellRef.value = cell;
                    if (colIdx % 2 === 0) {
                        cellRef.font = { bold: true };
                        cellRef.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF0F0F0' }
                        };
                    }
                });
            });

            // Пустая строка
            worksheet.getRow(8).height = 10;

            // Заголовки таблицы
            const headers = [
                '№', 'Дата', 'Наименование', 'Вес (гр)', 'Артикул',
                'Приходная цена', 'Продажная цена', 'Статус',
                'Тип оплаты', 'Дата продажи', 'Отправка', 'Расходы',
                'Возврат', 'Сумма возврата', 'Рассрочка'
            ];

            const headerRow = worksheet.getRow(9);
            headers.forEach((header, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = header;
                cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF8B6F47' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            headerRow.height = 30;

            // Данные товаров
            this.products.forEach((product, index) => {
                const row = worksheet.getRow(10 + index);
                
                const getPaymentType = (type) => {
                    if (!type) return '-';
                    const types = {
                        'cash': 'Наличные',
                        'cashless': 'Безналичные',
                        'installment': 'Рассрочка'
                    };
                    return types[type] || type;
                };

                const getStatus = (status) => {
                    return status === 'sold' ? 'Продано' : 'В наличии';
                };

                const formatDate = (dateStr) => {
                    if (!dateStr) return '-';
                    const date = new Date(dateStr);
                    return date.toLocaleDateString('ru-RU');
                };

                row.getCell(1).value = index + 1;
                row.getCell(2).value = formatDate(product.date);
                row.getCell(3).value = product.name;
                row.getCell(4).value = product.weight;
                row.getCell(5).value = product.article;
                row.getCell(6).value = product.purchasePrice;
                row.getCell(7).value = product.sellingPrice;
                row.getCell(8).value = getStatus(product.status);
                row.getCell(9).value = product.status === 'sold' ? getPaymentType(product.paymentType) : '-';
                row.getCell(10).value = formatDate(product.saleDate);
                row.getCell(11).value = product.shipmentDate ? formatDate(product.shipmentDate) : '-';
                row.getCell(12).value = product.expenses || 0;
                row.getCell(13).value = product.isReturn ? 'Да' : 'Нет';
                row.getCell(14).value = product.isReturn ? (product.returnAmount || 0) : 0;
                row.getCell(15).value = product.paymentType === 'installment' ? 'Да' : 'Нет';

                // Форматирование чисел
                [6, 7, 12, 14].forEach(col => {
                    const cell = row.getCell(col);
                    cell.numFmt = '#,##0.00 "₽"';
                });

                // Цветовое выделение строк
                if (product.status === 'sold') {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE8F5E9' }
                    };
                }
                if (product.isReturn) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFF3E0' }
                    };
                }

                // Границы
                headers.forEach((_, idx) => {
                    const cell = row.getCell(idx + 1);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle' };
                });

                row.height = 20;
            });

            // Автоматическая ширина колонок
            worksheet.columns.forEach((column, index) => {
                let maxLength = 10;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    try {
                        const value = cell.value ? cell.value.toString() : '';
                        if (value.length > maxLength) {
                            maxLength = value.length;
                        }
                    } catch (e) {}
                });
                column.width = Math.min(Math.max(maxLength + 2, 10), 30);
            });

            // Итоговая строка
            const lastRow = 10 + this.products.length;
            const summaryRow = worksheet.getRow(lastRow + 2);
            summaryRow.getCell(1).value = 'ИТОГО:';
            summaryRow.getCell(1).font = { bold: true, size: 12 };
            summaryRow.getCell(6).value = { formula: `SUM(F10:F${lastRow})` };
            summaryRow.getCell(7).value = { formula: `SUM(G10:G${lastRow})` };
            summaryRow.getCell(12).value = { formula: `SUM(L10:L${lastRow})` };
            summaryRow.getCell(14).value = { formula: `SUM(N10:N${lastRow})` };
            
            [6, 7, 12, 14].forEach(col => {
                const cell = summaryRow.getCell(col);
                cell.numFmt = '#,##0.00 "₽"';
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD4AF37' }
                };
            });

            summaryRow.height = 25;

            // Сохранение файла
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `jewelry_inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Ошибка при экспорте в Excel:', error);
            alert('Ошибка при экспорте в Excel. Убедитесь, что библиотека ExcelJS загружена.');
        }
    }

    // Import data
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (Array.isArray(importedData) && importedData.length > 0) {
                    // Merge with existing data or replace
                    const shouldReplace = confirm('Заменить все существующие данные? (Отмена - добавить к существующим)');

                    if (shouldReplace) {
                        this.products = importedData;
                    } else {
                        this.products = [...this.products, ...importedData];
                    }

                    this.saveData();
                    this.renderProducts();
                    this.updateStatistics();

                    alert('Данные успешно импортированы!');
                } else {
                    alert('Файл пуст или имеет неправильный формат!');
                }
            } catch (error) {
                alert('Ошибка при импорте данных: ' + error.message);
            }
        };
        reader.readAsText(file);

        // Reset input
        event.target.value = '';
    }

    // Load sample data
    loadSampleData() {
        fetch('sample-data.json')
            .then(response => response.json())
            .then(data => {
                if (confirm('Загрузить тестовые данные? (Текущие данные будут заменены)')) {
                    this.products = data;
                    this.saveData();
                    this.renderProducts();
                    this.updateStatistics();
                    alert('Тестовые данные загружены!');
                }
            })
            .catch(error => {
                alert('Не удалось загрузить тестовые данные: ' + error.message);
            });
    }

    // Setup table sorting
    setupTableSorting() {
        // Call after rendering
        setTimeout(() => {
            const headers = document.querySelectorAll('thead th');
            if (headers.length === 0) return;

            headers.forEach((header, index) => {
                // Skip last column (actions) and columns with icons (payment type columns)
                if (index === headers.length - 1 || index === 7 || index === 8) return;

                // Remove old event listeners
                const newHeader = header.cloneNode(true);
                header.parentNode.replaceChild(newHeader, header);

                if (!newHeader.querySelector('.sort-icon')) {
                    newHeader.style.cursor = 'pointer';
                    newHeader.style.userSelect = 'none';
                    newHeader.innerHTML += ` <i class="bi bi-arrow-down-up sort-icon"></i>`;
                    newHeader.addEventListener('click', () => {
                        this.sortTable(index);
                    });
                }
            });
        }, 100);
    }

    // Sort table
    sortTable(columnIndex) {
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;

        // Toggle sort order
        const currentSort = tbody.dataset.sortColumn;
        const newOrder = (currentSort == columnIndex && tbody.dataset.sortOrder === 'asc') ? 'desc' : 'asc';

        rows.sort((a, b) => {
            const cellA = a.cells[columnIndex];
            const cellB = b.cells[columnIndex];

            if (!cellA || !cellB) return 0;

            let valA = cellA.dataset.sort || cellA.textContent.trim();
            let valB = cellB.dataset.sort || cellB.textContent.trim();

            // Try to parse as number
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);

            if (!isNaN(numA) && !isNaN(numB)) {
                valA = numA;
                valB = numB;
            } else {
                // String comparison
                valA = String(cellA.textContent.trim());
                valB = String(cellB.textContent.trim());
            }

            if (newOrder === 'asc') {
                return valA > valB ? 1 : (valA < valB ? -1 : 0);
            } else {
                return valA < valB ? 1 : (valA > valB ? -1 : 0);
            }
        });

        // Update sort order
        tbody.dataset.sortColumn = columnIndex;
        tbody.dataset.sortOrder = newOrder;

        // Clear and repopulate
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));

        // Update icons - reset all first
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.textContent = ' ↕';
        });

        // Highlight current column
        const currentHeader = document.querySelectorAll('thead th')[columnIndex];
        if (currentHeader) {
            const icon = currentHeader.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = newOrder === 'asc' ? ' ↑' : ' ↓';
            }
        }
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new JewelryApp();
});

// Global functions for onclick handlers
function openProductModal(id = null) {
    if (app && typeof app.openProductModal === 'function') {
        app.openProductModal(id);
    } else {
        console.error('App not initialized');
    }
}

function saveProduct() {
    app.saveProduct();
}

function exportData() {
    app.exportData();
}

function exportToExcel() {
    app.exportToExcel();
}

function importData(event) {
    app.importData(event);
}

function loadSampleData() {
    app.loadSampleData();
}

function printReport() {
    window.print();
}

function confirmPaymentType(type) {
    app.confirmPaymentType(type);
}

function executeConfirmAction() {
    if (app.pendingConfirmAction) {
        app.pendingConfirmAction();
        app.pendingConfirmAction = null;
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
    modal.hide();
}

