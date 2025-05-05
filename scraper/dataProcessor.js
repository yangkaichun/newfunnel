/**
 * 處理從網站爬取的招標資訊數據
 * @param {Array} items 從網站爬取的原始招標資訊項目
 * @returns {Array} 處理後的招標資訊數據
 */
function processData(items) {
    if (!items || !Array.isArray(items)) {
        console.error('輸入數據無效');
        return [];
    }
    
    // 過濾無效數據
    const validItems = items.filter(item => 
        item && item.orgName && item.title
    );
    
    // 處理數據格式
    const processedItems = validItems.map((item, index) => {
        // 標準化日期格式
        let publishDate = item.publishDate;
        let deadline = item.deadline;
        try {
            if (publishDate) {
                const pubDate = new Date(publishDate);
                if (!isNaN(pubDate.getTime())) {
                    publishDate = formatDate(pubDate);
                }
            }
            
            if (deadline) {
                const deadDate = new Date(deadline);
                if (!isNaN(deadDate.getTime())) {
                    deadline = formatDate(deadDate);
                }
            }
        } catch (e) {
            console.warn('日期格式化錯誤', e);
        }
        
        // 返回處理後的項目
        return {
            ...item,
            id: item.id || (index + 1).toString(),
            publishDate,
            deadline,
            budget: formatBudget(item.budget)
        };
    });
    
    return processedItems;
}

/**
 * 格式化日期為 YYYY-MM-DD 格式
 * @param {Date} date 日期物件
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * 格式化預算金額
 * @param {string} budget 原始預算金額字串
 * @returns {string} 格式化後的預算金額
 */
function formatBudget(budget) {
    if (!budget) return '未公告';
    
    // 處理數字格式
    try {
        // 移除非數字字符並解析數值
        const value = budget.replace(/[^\d.-]/g, '');
        if (!value) return budget;
        
        const num = parseFloat(value);
        if (isNaN(num)) return budget;
        
        // 格式化為貨幣格式
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: 'TWD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    } catch (e) {
        console.warn('預算格式化錯誤', e);
        return budget;
    }
}

module.exports = { processData };
