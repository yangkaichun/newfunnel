// data.js
// 使用立即執行函數確保變數不污染全局空間
(function() {
    // 定義全局可訪問的 TenderDataService 類
    window.TenderDataService = class TenderDataService {
        constructor() {
            this.originalData = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.itemsPerPage = 10;
            this.currentSort = { field: null, ascending: true };
            this.lastUpdate = '';
            
            // 將實例保存在全局變數中，供 dataScraper.js 訪問
            window.tenderDataService = this;
        }
        
        // 更新數據方法 - 供 dataScraper.js 調用
        updateData(data) {
            console.log('TenderDataService: 更新數據');
            this.originalData = data.items || [];
            this.lastUpdate = data.lastUpdate || new Date().toLocaleString();
            this.filteredData = [...this.originalData];
            
            // 觸發數據更新事件
            const event = new CustomEvent('tenderDataUpdated', {
                detail: {
                    items: this.getPageData(),
                    total: this.filteredData.length,
                    pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
                    currentPage: this.currentPage,
                    lastUpdate: this.lastUpdate
                }
            });
            document.dispatchEvent(event);
            
            return {
                items: this.getPageData(),
                total: this.filteredData.length,
                pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
                currentPage: this.currentPage,
                lastUpdate: this.lastUpdate
            };
        }
        
        // 載入數據
        async loadData() {
            try {
                // 嘗試從本地JSON文件加載數據
                // 如果無法訪問，則使用模擬數據
                let data;
                try {
                    const response = await fetch('./data/tenderData.json');
                    if (!response.ok) {
                        throw new Error('無法獲取招標資料');
                    }
                    data = await response.json();
                } catch (e) {
                    // 如果無法獲取數據文件，使用默認示例數據
                    console.warn('無法從文件加載數據，使用模擬數據');
                    data = {
                        lastUpdate: new Date().toLocaleString(),
                        items: [
                            {
                                id: "1",
                                orgName: "臺北市政府衛生局",
                                title: "臺北市政府衛生局112年『臺北市食品安全管理應變計畫』",
                                publishDate: "2025-05-01",
                                deadline: "2025-05-15",
                                budget: "NT$2,500,000",
                                detailUrl: "#"
                            },
                            {
                                id: "2",
                                orgName: "衛生福利部",
                                title: "114年國家疫苗政策推動計畫",
                                publishDate: "2025-05-02",
                                deadline: "2025-05-20",
                                budget: "NT$5,600,000",
                                detailUrl: "#"
                            },
                            {
                                id: "3",
                                orgName: "國民健康署",
                                title: "114年國民營養監測計畫",
                                publishDate: "2025-05-03",
                                deadline: "2025-05-18",
                                budget: "NT$3,200,000",
                                detailUrl: "#"
                            },
                            {
                                id: "4",
                                orgName: "臺大醫院",
                                title: "臺大醫院急診部設備更新採購案",
                                publishDate: "2025-05-04",
                                deadline: "2025-05-25",
                                budget: "NT$8,700,000",
                                detailUrl: "#"
                            },
                            {
                                id: "5",
                                orgName: "高雄市政府衛生局",
                                title: "高雄市食品安全檢驗設備採購",
                                publishDate: "2025-05-02",
                                deadline: "2025-05-16",
                                budget: "NT$4,200,000",
                                detailUrl: "#"
                            }
                        ]
                    };
                }
                
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
                    item.orgName && item.orgName.includes(keyword)
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
                        valueA = new Date(a[field] || '').getTime() || 0;
                        valueB = new Date(b[field] || '').getTime() || 0;
                        break;
                    case 'budget':
                        valueA = parseFloat((a[field] || '').replace(/[^\d.-]/g, '')) || 0;
                        valueB = parseFloat((b[field] || '').replace(/[^\d.-]/g, '')) || 0;
                        break;
                    default:
                        valueA = a[field] || '';
                        valueB = b[field] || '';
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
    };
})();
