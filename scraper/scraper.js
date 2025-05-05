// scraper.js - Node.js 版本的爬蟲腳本
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 配置參數
const TARGET_URL = 'https://web.pcc.gov.tw/prkms/today/common/todayTender';
const DATA_FILE = path.join(__dirname, 'data', 'tenderData.json');

// 確保數據目錄存在
async function ensureDirectory() {
    const dataDir = path.dirname(DATA_FILE);
    try {
        await fs.access(dataDir);
    } catch (error) {
        // 目錄不存在，創建它
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`創建數據目錄: ${dataDir}`);
    }
}

// 主爬蟲函數
async function scrapeData() {
    console.log('開始爬取招標資訊...');
    
    // 確保數據目錄存在
    await ensureDirectory();
    
    let browser = null;
    
    try {
        // 啟動瀏覽器
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // 設置瀏覽器視窗大小
        await page.setViewport({ width: 1366, height: 768 });
        
        // 設置超時時間
        page.setDefaultTimeout(60000); // 1分鐘
        
        // 模擬真實使用者代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // 前往目標網站
        console.log(`正在訪問 ${TARGET_URL}`);
        await page.goto(TARGET_URL, { 
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        // 等待表格載入
        await page.waitForSelector('table.tender_table');
        console.log('資料表格已找到');
        
        // 抓取招標資訊
        console.log('開始擷取表格數據...');
        const tenderItems = await page.evaluate(() => {
            const items = [];
            
            // 查找招標表格
            const tenderTable = document.querySelector('table.tender_table');
            if (!tenderTable) return items;
            
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
            
            return items;
        });
        
        console.log(`成功爬取 ${tenderItems.length} 筆招標資訊`);
        
        // 處理和保存數據
        await saveData(tenderItems);
        
    } catch (error) {
        console.error(`爬取數據時發生錯誤: ${error.message}`);
    } finally {
        // 關閉瀏覽器
        if (browser) {
            await browser.close();
            console.log('瀏覽器已關閉');
        }
    }
}

// 保存數據到文件
async function saveData(items) {
    if (!items || items.length === 0) {
        console.warn('沒有數據可保存');
        return;
    }
    
    try {
        // 檢查是否有舊數據
        let oldData = { items: [] };
        try {
            const fileContent = await fs.readFile(DATA_FILE, 'utf8');
            oldData = JSON.parse(fileContent);
        } catch (error) {
            // 文件不存在或無法解析，使用空數據
            console.log('無法讀取舊數據，將創建新文件');
        }
        
        // 準備新數據
        const newData = {
            lastUpdate: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            items: items
        };
        
        // 將數據寫入文件
        await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2));
        console.log(`成功保存 ${items.length} 筆數據到 ${DATA_FILE}`);
    } catch (error) {
        console.error(`保存數據時發生錯誤: ${error.message}`);
    }
}

// 執行爬蟲
scrapeData()
    .then(() => console.log('爬蟲程序完成'))
    .catch(error => console.error(`程序執行錯誤: ${error.message}`));
