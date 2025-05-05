/ 數據處理相關函數
class TenderDataService {
    constructor() {
        this.originalData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSort = { field: null, ascending: true };
        this.lastUpdate = '';
    }
    
    // 載入數據
    async loadData() {
        try {
            const response = await fetch('./data/tenderData.json');
            if (!response.ok) {
                throw new Error('無法獲取招標資料');
            }
            
            const data = await response.json();
            this.originalData = data.items || [];
            this.lastUpdate = data.lastUpdate || new Date().toLocaleString();
            this.filteredData = [...this.originalData];
            
            return {
                items: this.getPageData(),
                total: this.filteredData.length,
                pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
                currentPage: this.currentPage,
                lastUpdate: this.lastUpdate
            };
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            return {
                items: [],
                total: 0,
                pages: 0,
                currentPage: 1,
                error: error.message,
                lastUpdate: '無法獲取'
            };
        }
    }
    
    // 篩選數據
    filterData(keyword) {
        if (!keyword) {
            this.filteredData = [...this.originalData];
        } else {
            this.filteredData = this.originalData.filter(item => 
                item.orgName.includes(keyword)
            );
        }
        this.currentPage = 1;
        return {
            items: this.getPageData(),
            total: this.filteredData.length,
            pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
            currentPage: this.currentPage
        };
    }
    
    // 排序數據
    sortData(field) {
        if (this.currentSort.field === field) {
            this.currentSort.ascending = !this.currentSort.ascending;
        } else {
            this.currentSort = { field, ascending: true };
        }
        
        this.filteredData.sort((a, b) => {
            let valueA, valueB;
            
            switch (field) {
                case 'publishDate':
                case 'deadline':
                    valueA = new Date(a[field]).getTime();
                    valueB = new Date(b[field]).getTime();
                    break;
                case 'budget':
                    valueA = parseFloat(a[field].replace(/[^\d.-]/g, '')) || 0;
                    valueB = parseFloat(b[field].replace(/[^\d.-]/g, '')) || 0;
                    break;
                default:
                    valueA = a[field];
                    valueB = b[field];
            }
            
            if (valueA < valueB) return this.currentSort.ascending ? -1 : 1;
            if (valueA > valueB) return this.currentSort.ascending ? 1 : -1;
            return 0;
        });
        
        return {
            items: this.getPageData(),
            total: this.filteredData.length,
            pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
            currentPage: this.currentPage,
            sort: this.currentSort
        };
    }
    
    // 分頁處理
    getPageData() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.filteredData.slice(start, end);
    }
    
    // 設置頁碼
    setPage(page) {
        const maxPage = Math.ceil(this.filteredData.length / this.itemsPerPage);
        this.currentPage = Math.max(1, Math.min(page, maxPage));
        
        return {
            items: this.getPageData(),
            total: this.filteredData.length,
            pages: maxPage,
            currentPage: this.currentPage
        };
    }
}
