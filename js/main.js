// main.js
document.addEventListener('DOMContentLoaded', function() {
    // 確保 TenderDataService 已經定義
    if (typeof TenderDataService !== 'function') {
        console.error('TenderDataService 未被定義，請確保 data.js 已正確加載');
        document.getElementById('noResults').textContent = 'TenderDataService 未被定義，系統無法正常運作';
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('loadingIndicator').style.display = 'none';
        return;
    }
    
    const dataService = new TenderDataService();
    const tbody = document.getElementById('tenderData');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const pagination = document.getElementById('pagination');
    const noResults = document.getElementById('noResults');
    const lastUpdateElement = document.getElementById('lastUpdate');
    
    const filterButtons = document.querySelectorAll('.filter-btn');
    const showAllButton = document.getElementById('showAll');
    const sortButtons = document.querySelectorAll('.sort-btn');
    const searchBtn = document.getElementById('searchBtn');
    const customKeyword = document.getElementById('customKeyword');
    
    let currentFilter = '';
    
    // 初始化加載數據
    initializeData();
    
    // 篩選按鈕事件
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const keyword = this.getAttribute('data-filter');
            currentFilter = keyword;
            
            // 更新按鈕狀態
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 篩選數據
            updateTableWithFilter(keyword);
        });
    });
    
    // 顯示全部按鈕事件
    showAllButton.addEventListener('click', function() {
        currentFilter = '';
        filterButtons.forEach(btn => btn.classList.remove('active'));
        updateTableWithFilter('');
    });
    
    // 自訂搜索按鈕事件
    searchBtn.addEventListener('click', function() {
        const keyword = customKeyword.value.trim();
        currentFilter = keyword;
        filterButtons.forEach(btn => btn.classList.remove('active'));
        updateTableWithFilter(keyword);
    });
    
    // 回車搜索
    customKeyword.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
    
    // 排序按鈕事件
    sortButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sortField = this.getAttribute('data-sort');
            
            // 更新排序狀態
            sortButtons.forEach(btn => {
                if (btn !== this) btn.classList.remove('active');
            });
            this.classList.toggle('active');
            
            // 對數據進行排序
            const result = dataService.sortData(sortField);
            updateTable(result.items);
            updatePagination(result.pages, result.currentPage);
        });
    });
    
    // 初始化數據
    async function initializeData() {
        showLoading(true);
        
        try {
            const result = await dataService.loadData();
            
            if (result.lastUpdate) {
                lastUpdateElement.textContent = result.lastUpdate;
            }
            
            if (result.error) {
                showError(result.error);
                return;
            }
            
            updateTable(result.items);
            updatePagination(result.pages, result.currentPage);
        } catch (error) {
            showError('載入資料時發生錯誤，請稍後再試');
            console.error(error);
        } finally {
            showLoading(false);
        }
    }
    
    // 更新表格資料
    function updateTable(items) {
        tbody.innerHTML = '';
        
        if (!items || items.length === 0) {
            noResults.style.display = 'block';
            return;
        }
        
        noResults.style.display = 'none';
        
        items.forEach((item, index) => {
            if (!item) return;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id || ''}</td>
                <td>${item.orgName || ''}</td>
                <td>${item.title || ''}</td>
                <td>${item.publishDate || ''}</td>
                <td>${item.deadline || ''}</td>
                <td>${item.budget || ''}</td>
                <td><a href="${item.detailUrl || '#'}" target="_blank" class="detail-btn">詳細</a></td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    // 使用篩選更新表格
    function updateTableWithFilter(keyword) {
        showLoading(true);
        
        setTimeout(() => {
            try {
                const result = dataService.filterData(keyword);
                updateTable(result.items);
                updatePagination(result.pages, result.currentPage);
            } catch (error) {
                showError('篩選數據時發生錯誤');
                console.error('篩選錯誤:', error);
            } finally {
                showLoading(false);
            }
        }, 200); // 模擬加載延遲
    }
    
    // 更新分頁
    function updatePagination(pages, currentPage) {
        pagination.innerHTML = '';
        
        if (!pages || pages <= 1) return;
        
        // 上一頁按鈕
        if (currentPage > 1) {
            addPaginationButton('«', currentPage - 1);
        }
        
        // 頁碼按鈕
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(pages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            addPaginationButton(i.toString(), i, i === currentPage);
        }
        
        // 下一頁按鈕
        if (currentPage < pages) {
            addPaginationButton('»', currentPage + 1);
        }
    }
    
    // 添加分頁按鈕
    function addPaginationButton(text, pageNum, isActive = false) {
        const button = document.createElement('button');
        button.textContent = text;
        if (isActive) button.classList.add('active');
        
        button.addEventListener('click', function() {
            const result = dataService.setPage(pageNum);
            updateTable(result.items);
            updatePagination(result.pages, result.currentPage);
        });
        
        pagination.appendChild(button);
    }
    
    // 顯示/隱藏載入中狀態
    function showLoading(show) {
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }
    
    // 顯示錯誤訊息
    function showError(message) {
        if (noResults) {
            noResults.textContent = message;
            noResults.style.display = 'block';
        }
    }
});
