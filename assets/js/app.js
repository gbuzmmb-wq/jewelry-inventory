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
        const hasLocalData = localData && localData !== '[]' && localData !== 'null';
        
        if (hasLocalData) {
            try {
                const parsed = JSON.parse(localData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.products = parsed.map(item => ({
                        ...item,
                        date: item.date || new Date().toISOString().split('T')[0],
                        saleDate: item.saleDate || null
                    }));
                }
            } catch (e) {
                console.error('Error parsing local data:', e);
            }
        }

        // Render immediately with local data (if any)
        this.renderProducts();
        this.updateStatistics();
        
        console.log(`📊 Загружено из localStorage: ${this.products.length} товаров`);

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
                        this.syncFromGitHub(true).then(() => {
                            this.renderProducts();
                            this.updateStatistics();
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
        
        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
        console.log(`✅ Данные сохранены в localStorage: ${productsCount} товаров`);
        
        // Auto-sync to GitHub if enabled
        if (this.syncEnabled && this.githubToken) {
            console.log(`🔄 Синхронизация включена, отправка на GitHub...`);
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
            const productsCount = this.products ? this.products.length : 0;
            console.log(`📤 Синхронизация на GitHub: ${productsCount} товаров`);
            
            if (productsCount === 0) {
                console.warn('⚠️ Нет данных для синхронизации (products пустой)');
                // Но все равно отправляем, чтобы обновить gist
            }

            const data = JSON.stringify(this.products, null, 2);
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
                
                const remoteData = JSON.parse(file.content);
                
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
                        
                        console.log(`Merged: ${merged.length} items (${remoteCount} remote + ${merged.length - remoteCount} local-only)`);
                        
                        this.products = merged.map(item => ({
                            ...item,
                            date: item.date || new Date().toISOString().split('T')[0],
                            saleDate: item.saleDate || null
                        }));
                        
                        // Save merged data to localStorage
                        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
                        
                        // Force render - especially important on mobile
                        setTimeout(() => {
                            this.renderProducts();
                            this.updateStatistics();
                        }, 100);
                        
                        // Also render immediately
                        this.renderProducts();
                        this.updateStatistics();
                        
                        console.log(`✅ Данные загружены и отображены: ${merged.length} товаров`);
                        
                        // Уведомления отключены
                        // if (!silent) {
                        //     this.showSyncNotification(`✅ Загружено ${remoteCount} товаров с GitHub`, 'success');
                        // }
                        return true;
                    }
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

        // Уведомления отключены
        // this.showSyncNotification('🔄 Синхронизация...', 'info');
        
        // First sync to GitHub (upload)
        await this.syncToGitHub();
        
        // Then sync from GitHub (download)
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

        statusSelect.addEventListener('change', () => {
            const isSold = statusSelect.value === 'sold';
            document.getElementById('payment-type-container').style.display = isSold ? 'block' : 'none';
            document.getElementById('sale-date-container').style.display = isSold ? 'block' : 'none';
        });

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
                document.getElementById('product-payment-type').value = product.paymentType || 'cash';
                document.getElementById('product-sale-date').value = product.saleDate || '';

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
                : null
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

        // Render immediately (don't wait for save)
        this.renderProducts();
        this.updateStatistics();
        
        // Save data (async, in background)
        console.log(`💾 Сохранение товара: ${this.products.length} товаров в списке`);
        this.saveData().then(() => {
            console.log(`✅ Данные сохранены: ${this.products.length} товаров`);
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

    // Reset form
    resetForm() {
        document.getElementById('productForm').reset();
        this.currentEditId = null;
        document.getElementById('product-id').value = '';
        document.getElementById('product-date').value = new Date().toISOString().split('T')[0];
    }

    // Render products table
    renderProducts(products = this.products) {
        const tbody = document.getElementById('products-tbody');
        const noProducts = document.getElementById('no-products');

        if (products.length === 0) {
            tbody.innerHTML = '';
            noProducts.style.display = 'block';
            this.setupTableSorting();
            return;
        }

        noProducts.style.display = 'none';
        tbody.innerHTML = products.map((product, index) => {
            const profit = product.sellingPrice - product.purchasePrice;
            const isSold = product.status === 'sold';
            const isCashSale = isSold && product.paymentType === 'cash';
            const isCardSale = isSold && product.paymentType === 'cashless';

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
                    <td class="action-buttons">
                        ${!isSold ? `
                            <button class="btn btn-sm btn-success" onclick="app.markAsSold('${product.id}')" title="Отметить как проданный">
                                <i class="bi bi-check-circle"></i>
                            </button>
                        ` : ''}
                        ${isSold ? `
                            <button class="btn btn-sm btn-warning" onclick="app.revertSoldStatus('${product.id}')" title="Отменить продажу">
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
            filtered = filtered.filter(p => p.status === statusFilter);
        }

        this.renderProducts(filtered);
    }

    // Update statistics
    updateStatistics() {
        const totalProducts = this.products.length;
        const soldProducts = this.products.filter(p => p.status === 'sold').length;
        const inStock = totalProducts - soldProducts;

        const totalProfit = this.products
            .filter(p => p.status === 'sold')
            .reduce((sum, p) => sum + (p.sellingPrice - p.purchasePrice), 0);

        document.getElementById('total-products').textContent = totalProducts;
        document.getElementById('sold-products').textContent = soldProducts;
        document.getElementById('in-stock').textContent = inStock;
        document.getElementById('total-profit').textContent = totalProfit.toFixed(2) + ' ₽';
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

