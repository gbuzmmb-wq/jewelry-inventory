// Jewelry Inventory Management App
// Main Application Logic

class JewelryApp {
    constructor() {
        this.products = [];
        this.currentEditId = null;
        this.charts = {};
        this.currentUser = null;
        this.credentials = {
            'admin': { password: 'admin', role: 'admin', name: 'Администратор' },
            'seller': { password: 'seller', role: 'seller', name: 'Продавец' }
        };
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupAuthListeners();
        this.loadData();
        this.setupEventListeners();
        this.renderProducts();
        this.updateStatistics();
        this.initTabs();
        this.initCharts();
        this.setupModalListeners();
        this.setupTableSorting();
    }

    // Check authentication
    checkAuth() {
        const userData = sessionStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            this.updateUI();
            return;
        }
        // Show auth modal
        this.showAuthModal();
    }

    // Show auth modal
    showAuthModal() {
        const modal = new bootstrap.Modal(document.getElementById('authModal'), {
            backdrop: 'static',
            keyboard: false
        });
        modal.show();
    }

    // Setup auth listeners
    setupAuthListeners() {
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
    }

    // Login
    login() {
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;

        if (this.credentials[username] && this.credentials[username].password === password) {
            this.currentUser = {
                username: username,
                role: this.credentials[username].role,
                name: this.credentials[username].name
            };

            sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
            modal.hide();

            this.updateUI();
            this.renderProducts();

            // Show success message
            setTimeout(() => {
                alert(`Добро пожаловать, ${this.currentUser.name}!`);
            }, 100);
        } else {
            alert('Неверный логин или пароль!');
        }
    }

    // Logout
    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            sessionStorage.removeItem('currentUser');
            this.currentUser = null;
            this.showAuthModal();
            this.renderProducts();
        }
    }

    // Update UI based on user role
    updateUI() {
        if (!this.currentUser) return;

        document.getElementById('current-user-name').textContent = this.currentUser.name;
        document.getElementById('dropdown-username').textContent = this.currentUser.username;

        const roleBadge = document.getElementById('user-role-badge');
        const dropdownRole = document.getElementById('dropdown-role');

        if (this.currentUser.role === 'admin') {
            roleBadge.textContent = 'Админ';
            roleBadge.className = 'badge ms-2 bg-danger';
            dropdownRole.textContent = 'Администратор';
            dropdownRole.className = 'badge bg-danger';
        } else {
            roleBadge.textContent = 'Продавец';
            roleBadge.className = 'badge ms-2 bg-info';
            dropdownRole.textContent = 'Продавец';
            dropdownRole.className = 'badge bg-info';
        }

        // Show/hide controls based on role
        const addButton = document.querySelector('button[data-bs-toggle="modal"][data-bs-target="#productModal"]');
        if (addButton) {
            addButton.style.display = this.currentUser.role === 'admin' ? '' : 'none';
        }

        const exportButton = document.querySelector('button[onclick="exportData()"]');
        if (exportButton) {
            exportButton.style.display = this.currentUser.role === 'admin' ? '' : 'none';
        }

        const importButton = document.querySelector('button[onclick="document.getElementById(\'import-input\').click()"]');
        if (importButton) {
            importButton.style.display = this.currentUser.role === 'admin' ? '' : 'none';
        }

        const sampleDataButton = document.querySelector('button[onclick="loadSampleData()"]');
        if (sampleDataButton) {
            sampleDataButton.style.display = this.currentUser.role === 'admin' ? '' : 'none';
        }

        const printButton = document.querySelector('button[onclick="printReport()"]');
        if (printButton) {
            printButton.style.display = this.currentUser.role === 'admin' ? '' : 'none';
        }
    }

    // Check if user is admin
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    // Check if user is seller
    isSeller() {
        return this.currentUser && this.currentUser.role === 'seller';
    }

    // Load data from localStorage
    loadData() {
        const data = localStorage.getItem('jewelryProducts');
        if (data) {
            this.products = JSON.parse(data).map(item => ({
                ...item,
                date: item.date || new Date().toISOString().split('T')[0],
                saleDate: item.saleDate || null
            }));
        }
    }

    // Save data to localStorage
    saveData() {
        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
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
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');

        if (productId) {
            // Edit mode
            modal.querySelector('.modal-title').textContent = 'Редактировать товар';
            const product = this.products.find(p => p.id === productId);
            if (product) {
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
        } else {
            // Add mode
            modal.querySelector('.modal-title').textContent = 'Добавить товар';
            form.reset();
            document.getElementById('product-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('product-status').dispatchEvent(new Event('change'));
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
            }
        } else {
            // Add new
            this.products.push(productData);
        }

        this.saveData();
        this.renderProducts();
        this.updateStatistics();
        this.resetForm();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        modal.hide();
    }

    // Delete product
    deleteProduct(id) {
        if (confirm('Вы уверены, что хотите удалить этот товар?')) {
            this.products = this.products.filter(p => p.id !== id);
            this.saveData();
            this.renderProducts();
            this.updateStatistics();
        }
    }

    // Mark as sold
    markAsSold(id) {
        const product = this.products.find(p => p.id === id);
        if (product) {
            product.status = 'sold';
            product.saleDate = product.saleDate || new Date().toISOString().split('T')[0];
            product.paymentType = product.paymentType || 'cash';
            product.soldBy = this.currentUser.username;
            product.soldAt = new Date().toISOString();
            this.saveData();
            this.renderProducts();
            this.updateStatistics();
        }
    }

    // Revert sold status (admin only)
    revertSoldStatus(id) {
        if (!this.isAdmin()) {
            alert('Только администратор может отменить продажу!');
            return;
        }

        const product = this.products.find(p => p.id === id);
        if (product && product.status === 'sold') {
            if (confirm('Вы уверены, что хотите отменить продажу этого товара?')) {
                product.status = 'in-stock';
                product.saleDate = null;
                product.paymentType = null;
                delete product.soldBy;
                delete product.soldAt;
                this.saveData();
                this.renderProducts();
                this.updateStatistics();
            }
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
        tbody.innerHTML = products.map(product => {
            const profit = product.sellingPrice - product.purchasePrice;
            const isSold = product.status === 'sold';
            const statusClass = isSold ? 'status-sold' : 'status-stock';
            const statusText = isSold ? 'Продано' : 'В наличии';
            const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
            const paymentType = product.paymentType === 'cash' ? 'Наличные' : 'Безнал';

            return `
                <tr data-id="${product.id}">
                    <td>${this.formatDate(product.date)}</td>
                    <td><strong>${this.escapeHtml(product.name)}</strong></td>
                    <td data-sort="${product.weight}">${product.weight} гр</td>
                    <td><code>${this.escapeHtml(product.article)}</code></td>
                    <td data-sort="${product.purchasePrice}">${product.purchasePrice.toFixed(2)} ₽</td>
                    <td data-sort="${product.sellingPrice}">${product.sellingPrice.toFixed(2)} ₽</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="${profitClass}" data-sort="${profit}">${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ₽</td>
                    <td class="action-buttons">
                        ${!isSold ? `
                            <button class="btn btn-sm btn-success" onclick="app.markAsSold('${product.id}')" title="Отметить как проданный">
                                <i class="bi bi-check-circle"></i>
                            </button>
                        ` : ''}
                        ${this.isAdmin() ? `
                            ${isSold ? `
                                <button class="btn btn-sm btn-warning" onclick="app.revertSoldStatus('${product.id}')" title="Отменить продажу">
                                    <i class="bi bi-arrow-counterclockwise"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-primary" onclick="app.openProductModal('${product.id}')" title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteProduct('${product.id}')" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
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
                // Skip action column
                if (index === headers.length - 1) return;

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
    app.openProductModal(id);
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

