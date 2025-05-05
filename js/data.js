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
            
            // 將實例保存在全局變數中
            window.tenderDataService = this;
        }
        
        // 載入數據
        async loadData() {
            try {
                console.log('從 JSON 文件加載招標資訊...');
                
                // 添加時間戳參數避免瀏覽器緩存
                const timestamp = new Date().getTime();
                const response = await fetch(`./data/tenderData.json?t=${timestamp}`);
                
                if (!response.ok) {
                    throw new Error(`無法獲取招標資料 (${response.status})`);
                }
                
                const data = await response.json();
                console.log('數據加載成功', data);
                
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
                
                // 發生錯誤時使用示例數據
                console.warn('使用示例數據作為後備');
                
                this.originalData = this.getSampleData();
                this.lastUpdate = '無法連接到數據源 - ' + new Date().toLocaleString();
                this.filteredData = [...this.originalData];
                
                return {
                    items: this.getPageData(),
                    total: this.filteredData.length,
                    pages: Math.ceil(this.filteredData.length / this.itemsPerPage),
                    currentPage: this.currentPage,
                    error: error.message,
                    lastUpdate: this.lastUpdate
                };
            }
        }
        
        // 示例數據，作為後備
        getSampleData() {
            return [
                {
                    id: "1",
                    orgName: "臺北市政府衛生局",
                    title: "臺北市政府衛生局112年『臺北市食品安全管理應變計畫』",
                    publishDate: "2025-05-01",
                    deadline: "2025-05-15",
                    budget: "NT$2,500,000",
                    detailUrl: "#"
                },
                // 其他示例數據...
                {
                    id: "5",
                    orgName: "高雄市政府衛生局",
                    title: "高雄市食品安全檢驗設備採購",
                    publishDate: "2025-05-02",
                    deadline: "2025-05-16",
                    budget: "NT$4,200,000",
                    detailUrl: "#"
                }
            ];
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
            // 排序邏輯不變
        }
        
        // 分頁處理
        getPageData() {
            // 分頁邏輯不變
        }
        
        // 設置頁碼
        setPage(page) {
            // 設置頁碼邏輯不變
        }
    };
})();
