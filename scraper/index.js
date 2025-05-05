const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { processData } = require('./dataProcessor');
const cron = require('cron');

// 設定檔案路徑
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'tenderData.json');

// 確保數據資料夾存在
fs.ensureDirSync(DATA_DIR);

// 政府採購招標網站URL
const TARGET_URL = 'https://web.pcc.gov.tw/prkms/today/common/todayTender';

// 主要爬蟲函數
async function scrapeData() {
    console.log('開始爬取招標資訊...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // 設置超時時間
        page.setDefaultTimeout(60000);
        
        // 前往目標網站
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
        console.log('頁面載入完成');
        
        // 等待表格載入
        await page.waitForSelector('table.tender_table');
        console.log('資料表格已找到');
        
        // 抓取招標資訊
        const tenderItems = await page.evaluate(() => {
            const items = [];
            const rows = document.querySelectorAll('table.tender_table tbody tr');
            
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
        
        // 處理爬取的資料
        const processedData = processData(tenderItems);
        
        // 儲存資料
        await saveData(processedData);
        
        console.log('招標資訊已成功儲存');
    } catch (error) {
        console.error('爬取資料時發生錯誤:', error);
    } finally {
        await browser.close();
        console.log('爬蟲程序完成，瀏覽器已關閉');
    }
}

// 儲存處理後的數據
async function saveData(data) {
    try {
        const jsonData = {
            lastUpdate: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            items: data
        };
        
        await fs.writeJson(DATA_FILE, jsonData, { spaces: 2 });
        console.log(`資料已儲存至 ${DATA_FILE}`);
    } catch (error) {
        console.error('儲存資料時發生錯誤:', error);
        throw error;
    }
}

// 主程序
async function main() {
    try {
        await scrapeData();
    } catch (error) {
        console.error('主程序執行錯誤:', error);
    }
}

// 設置定時任務 (每天早上 6 點執行)
const cronJob = new cron.CronJob('0 6 * * *', main, null, false, 'Asia/Taipei');
cronJob.start();
console.log('定時爬蟲已啟動，將每天早上 6 點執行');

// 立即執行第一次爬蟲
main();

// 導出函數供其他模塊使用
module.exports = { scrapeData, saveData };
