// dataScraper.js - 用於處理原始招標網站數據

// 建立數據爬取對象
const TenderScraper = {
    sourceUrl: 'https://web.pcc.gov.tw/prkms/today/common/todayTender',
    proxyUrl: 'proxy.php', // 後端代理腳本
    iframe: null,
    
    // 初始化
    init: function() {
        console.log('初始化 TenderScraper...');
        this.iframe = document.getElementById('sourceFrame');
        
        // 嘗試使用代理加載數據
        this.fetchThroughProxy()
            .then(data => {
                console.log('透過代理成功獲取資料');
                this.processData(data);
            })
            .catch(error => {
                console.warn('代理獲取失敗，嘗試直接加載 iframe:', error);
                this.loadIframe();
            });
    },
    
    // 通過代理獲取數據
    fetchThroughProxy: async function() {
        try {
            const response = await fetch(this.proxyUrl + '?url=' + encodeURIComponent(this.sourceUrl));
            if (!response.ok) {
                throw new Error(`HTTP錯誤: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error('代理請求失敗:', error);
            throw error;
        }
    },
    
    // 加載 iframe
    loadIframe: function() {
        console.log('加載原始網站 iframe...');
        
        // 設定 iframe 載入事件
        this.iframe.onload = () => {
            console.log('iframe 加載完成，開始處理數據');
            try {
                this.scrapeFromIframe();
            } catch (e) {
                console.error('從 iframe 抓取數據時發生錯誤:', e);
                // 顯示錯誤訊息
                document.getElementById('noResults').textContent = '無法從原始網站讀取數據，請稍後再試';
                document.getElementById('noResults').style.display = 'block';
                document.getElementById('loadingIndicator').style.display = 'none';
            }
        };
        
        // 開始載入原始網站
        this.iframe.src = this.sourceUrl;
    },
    
    // 從 iframe 抓取數據
    scrapeFromIframe: function() {
        try {
            // 檢查 iframe 是否正確載入
            if (!this.iframe.contentDocument) {
                throw new Error('無法訪問 iframe 內容，可能是跨域限制');
            }
            
            const iframeDoc = this.iframe.contentDocument;
            
            // 查找招標表格
            const tenderTable = iframeDoc.querySelector('table.tender_table');
            if (!tenderTable) {
                throw new Error('無法在原始網站找到招標表格');
            }
            
            const rows = tenderTable.querySelectorAll('tbody tr');
            const items = [];
            
            // 處理每一行數據
            rows.forEach((row, index) => {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 6) {
                    // 獲取詳細連結
                    const detailLink = columns[2].querySelector('a');
                    const detailUrl = detailLink ? detailLink.href : '';
                    
                    // 組織招標資訊項目
                    items.push({
                        id: columns[0].textContent.trim(),
                        orgName: columns[1].textContent.trim(),
                        title: columns[2].textContent.trim(),
                        publishDate: columns[3].textContent.trim(),
                        deadline: columns[4].textContent.trim(),
                        budget: columns[5].textContent.trim(),
                        detailUrl: detailUrl
                    });
                }
            });
            
            console.log(`從 iframe 成功抓取 ${items.length} 筆招標資訊`);
            
            // 處理抓取的數據
            this.processData(items);
        } catch (error) {
            console.error('從 iframe 抓取數據時發生錯誤:', error);
            
            // 嘗試使用備用方法
            this.tryBackupMethod();
        }
    },
    
    // 處理和保存數據
    processData: function(data) {
        // 如果 data 是 HTML 字符串，嘗試解析出數據
        let items = [];
        
        if (typeof data === 'string') {
            // 創建臨時 DOM 解析 HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');
            
            // 查找招標表格
            const tenderTable = doc.querySelector('table.tender_table');
            if (tenderTable) {
                const rows = tenderTable.querySelectorAll('tbody tr');
                
                // 處理每一行數據
                rows.forEach((row, index) => {
                    const columns = row.querySelectorAll('td');
                    if (columns.length >= 6) {
                        // 獲取詳細連結
                        const detailLink = columns[2].querySelector('a');
                        const detailUrl = detailLink ? detailLink.href : '';
                        
                        // 組織招標資訊項目
                        items.push({
                            id: columns[0].textContent.trim(),
                            orgName: columns[1].textContent.trim(),
                            title: columns[2].textContent.trim(),
                            publishDate: columns[3].textContent.trim(),
                            deadline: columns[4].textContent.trim(),
                            budget: columns[5].textContent.trim(),
                            detailUrl: detailUrl
                        });
                    }
                });
            }
        } else if (Array.isArray(data)) {
            items = data;
        }
        
        // 如果成功獲取數據
        if (items.length > 0) {
            console.log(`成功解析 ${items.length} 筆招標資訊`);
            
            // 創建要保存的數據對象
            const dataToSave = {
                lastUpdate: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
                items: items
            };
            
            // 發送到後端保存
            this.saveToJson(dataToSave);
            
            // 通知數據服務更新數據
            if (window.tenderDataService) {
                console.log('通知數據服務更新數據');
                window.tenderDataService.updateData(dataToSave);
            }
        } else {
            console.error('解析後沒有數據');
            this.tryBackupMethod();
        }
    },
    
    // 保存數據到 JSON 文件
    saveToJson: function(data) {
        console.log('嘗試保存數據到 tenderData.json');
        
        // 使用 fetch API 發送 POST 請求到後端
        fetch('saveData.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            console.log('保存數據結果:', result);
        })
        .catch(error => {
            console.error('保存數據失敗:', error);
        });
    },
    
    // 備用方法 - 使用預設數據
    tryBackupMethod: function() {
        console.log('使用備用方法加載數據');
        
        // 從本地 JSON 文件加載
        fetch('./data/tenderData.json')
            .then(response => response.json())
            .then(data => {
                console.log('成功從本地 JSON 文件加載數據');
                
                // 通知數據服務更新數據
                if (window.tenderDataService) {
                    window.tenderDataService.updateData(data);
                }
            })
            .catch(error => {
                console.error('本地 JSON 文件加載失敗:', error);
                // 最後的備用選項：使用硬編碼的示例數據
                this.useHardcodedData();
            });
    },
    
    // 使用硬編碼的示例數據
    useHardcodedData: function() {
        console.log('使用硬編碼的示例數據');
        
        const sampleData = {
            lastUpdate: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
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
        
        // 通知數據服務更新數據
        if (window.tenderDataService) {
            window.tenderDataService.updateData(sampleData);
        }
    }
};

// 頁面加載完成後初始化爬取器
document.addEventListener('DOMContentLoaded', function() {
    console.log('頁面加載完成，初始化爬取器');
    TenderScraper.init();
});
