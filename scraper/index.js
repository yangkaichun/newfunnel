const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { processData } = require('./dataProcessor');
const cron = require('cron');

// 設定檔案路徑
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'tenderData.json');
const LOG_FILE = path.join(__dirname, '../logs/scraper.log');

// 確保數據和日誌資料夾存在
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(path.dirname(LOG_FILE));

// 記錄函數
function logMessage(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console[isError ? 'error' : 'log'](message);
    fs.appendFileSync(LOG_FILE, logEntry);
}

// 政府採購招標網站URL
const TARGET_URL = 'https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic';

/**
 * 主要爬蟲函數 - 爬取招標資訊
 */
async function scrapeData() {
    logMessage('開始爬取招標資訊...');
    
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
        page.setDefaultTimeout(120000); // 2分鐘
        
        // 模擬真實使用者代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // 監聽控制台輸出
        page.on('console', msg => logMessage(`頁面控制台: ${msg.text()}`));
        
        // 監聽頁面錯誤
        page.on('pageerror', error => logMessage(`頁面錯誤: ${error.message}`, true));
        
        // 前往目標網站
        logMessage(`正在訪問 ${TARGET_URL}`);
        await page.goto(TARGET_URL, { 
            waitUntil: 'networkidle2',
            timeout: 60000 // 增加導航超時
        });
        logMessage('頁面載入完成');
        
        // 檢查頁面標題確認是否成功載入
        const title = await page.title();
        logMessage(`頁面標題: ${title}`);
        
        // 等待表格載入 (使用更可靠的等待方式)
        try {
            await page.waitForFunction(
                () => document.querySelector('table.tender_table') !== null,
                { timeout: 30000 }
            );
            logMessage('資料表格已找到');
        } catch (e) {
            // 如果找不到主表格，檢查是否有其他識別元素
            const pageContent = await page.content();
            if (pageContent.includes('驗證碼')) {
                logMessage('頁面需要驗證碼，嘗試處理...');
                // 這裡可以添加處理驗證碼的邏輯
                throw new Error('網站需要驗證碼，無法自動爬取');
            } else {
                // 儲存頁面以供調試
                await fs.writeFile(path.join(DATA_DIR, 'page_dump.html'), pageContent);
                throw new Error('無法找到目標表格，頁面結構可能已變更');
            }
        }
        
        // 截圖保存，方便調試
        await page.screenshot({ path: path.join(DATA_DIR, 'screenshot.png') });
        
        // 抓取招標資訊
        logMessage('開始擷取表格數據...');
        const tenderItems = await page.evaluate(() => {
            const items = [];
            try {
                // 查找表格和行
                const tenderTable = document.querySelector('table.tender_table');
                if (!tenderTable) throw new Error('找不到招標表格');
                
                const rows = tenderTable.querySelectorAll('tbody tr');
                if (!rows.length) throw new Error('表格中無數據行');
                
                // 處理每一行
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
                
                console.log(`成功從頁面擷取 ${items.length} 筆招標資訊`);
                return items;
            } catch (e) {
                console.error('頁面擷取錯誤: ' + e.message);
                return [];
            }
        });
        
        logMessage(`成功爬取 ${tenderItems.length} 筆招標資訊`);
        
        // 檢查資料是否為空
        if (tenderItems.length === 0) {
            logMessage('警告: 未獲取到任何招標資訊，請檢查頁面結構或網站是否改版', true);
            return;
        }
        
        // 詳細資訊爬取 (對每個項目獲取更多信息)
        const enhancedItems = [];
        for (let i = 0; i < Math.min(tenderItems.length, 10); i++) {  // 限制最多處理前10個項目
            const item = tenderItems[i];
            if (item.detailUrl && item.detailUrl !== '#' && item.detailUrl !== '') {
                try {
                    logMessage(`爬取詳細資訊 [${i+1}/${Math.min(tenderItems.length, 10)}]: ${item.title}`);
                    const enhancedItem = await scrapeDetailPage(browser, item);
                    enhancedItems.push(enhancedItem);
                } catch (error) {
                    logMessage(`爬取詳細資訊失敗: ${error.message}`, true);
                    enhancedItems.push(item);  // 如果失敗，保留原始項目
                }
                
                // 延遲以避免請求過於頻繁
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
            } else {
                enhancedItems.push(item);
            }
        }
        
        // 合併所有項目
        const allItems = [
            ...enhancedItems,
            ...tenderItems.slice(Math.min(tenderItems.length, 10))
        ];
        
        // 處理爬取的資料
        const processedData = processData(allItems);
        
        // 儲存資料
        await saveData(processedData);
        
        logMessage('招標資訊已成功儲存');
    } catch (error) {
        logMessage(`爬取資料時發生錯誤: ${error.message}`, true);
        logMessage(error.stack, true);
        
        // 失敗重試邏輯可以在這裡添加
    } finally {
        if (browser) {
            await browser.close();
            logMessage('瀏覽器已關閉');
        }
        logMessage('爬蟲程序完成');
    }
}

/**
 * 爬取招標詳細頁面
 * @param {Browser} browser Puppeteer browser實例
 * @param {Object} item 招標項目基本信息
 * @returns {Object} 增強後的招標項目
 */
async function scrapeDetailPage(browser, item) {
    const page = await browser.newPage();
    try {
        await page.goto(item.detailUrl, { waitUntil: 'networkidle2' });
        
        // 在詳細頁面中提取更多信息
        const enhancedInfo = await page.evaluate(() => {
            const info = {};
            
            // 提取機關地址 (這僅為示例，實際需要根據頁面結構調整)
            const addressElement = document.querySelector('.org_address, .tender_org_address');
            if (addressElement) {
                info.orgAddress = addressElement.textContent.trim();
            }
            
            // 提取聯絡人
            const contactElement = document.querySelector('.contact_person, .tender_contact');
            if (contactElement) {
                info.contactPerson = contactElement.textContent.trim();
            }
            
            // 其他可能的信息 (電話、投標方式等)
            const phoneElement = document.querySelector('.contact_phone, .tender_phone');
            if (phoneElement) {
                info.contactPhone = phoneElement.textContent.trim();
            }
            
            return info;
        });
        
        // 合併基本信息和詳細信息
        return { ...item, ...enhancedInfo };
    } catch (error) {
        logMessage(`詳細頁面爬取錯誤 (${item.id}): ${error.message}`, true);
        return item;  // 返回原始項目
    } finally {
        await page.close();
    }
}

/**
 * 儲存處理後的數據
 * @param {Array} data 處理後的招標資訊數據
 */
async function saveData(data) {
    try {
        // 檢查是否有舊數據
        let oldData = [];
        if (await fs.pathExists(DATA_FILE)) {
            try {
                const oldContent = await fs.readJson(DATA_FILE);
                oldData = oldContent.items || [];
            } catch (e) {
                logMessage('讀取舊數據失敗，將使用新數據替換', true);
            }
        }
        
        // 如果新數據為空且舊數據存在，保留舊數據
        if (data.length === 0 && oldData.length > 0) {
            logMessage('警告: 新數據為空，保留舊數據', true);
            return;
        }
        
        // 合併新舊數據，移除重複項
        const mergedData = [...data];
        const existingIds = new Set(data.map(item => item.id));
        
        for (const oldItem of oldData) {
            if (!existingIds.has(oldItem.id)) {
                mergedData.push(oldItem);
            }
        }
        
        // 組織最終的 JSON 數據
        const jsonData = {
            lastUpdate: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            totalItems: mergedData.length,
            items: mergedData
        };
        
        // 寫入檔案
        await fs.writeJson(DATA_FILE, jsonData, { spaces: 2 });
        logMessage(`資料已儲存至 ${DATA_FILE}，共 ${mergedData.length} 筆資料`);
    } catch (error) {
        logMessage(`儲存資料時發生錯誤: ${error.message}`, true);
        throw error;
    }
}

/**
 * 主程序
 */
async function main() {
    try {
        logMessage('開始執行招標資訊爬蟲主程序');
        await scrapeData();
        logMessage('招標資訊爬蟲主程序執行完成');
    } catch (error) {
        logMessage(`主程序執行錯誤: ${error.message}`, true);
        logMessage(error.stack, true);
    }
}

// 檢查是否為直接執行
if (require.main === module) {
    // 設置定時任務 (每天早上 6 點執行)
    const cronJob = new cron.CronJob('0 6 * * *', main, null, false, 'Asia/Taipei');
    cronJob.start();
    logMessage('定時爬蟲已啟動，將每天早上 6 點執行');
    
    // 立即執行第一次爬蟲
    main();
} else {
    // 作為模組被導入時不自動執行
    logMessage('爬蟲模組已載入，但不自動執行');
}

// 導出函數供其他模塊使用
module.exports = { scrapeData, saveData, main };
