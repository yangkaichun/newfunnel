<?php
// update_tender_data.php - 直接爬取招標網站並更新 JSON 數據

// 設置執行時間上限 (5分鐘)
set_time_limit(300);

// 禁用輸出緩衝，實時顯示進度
ob_implicit_flush(true);
ob_end_flush();

// 記錄開始時間
$startTime = microtime(true);

// 日誌函數
function log_message($message) {
    $timestamp = date('[Y-m-d H:i:s]');
    echo "$timestamp $message<br>\n";
    flush();
}

log_message("開始執行招標資訊更新程序");

// 目標 URL
$targetUrl = 'https://web.pcc.gov.tw/prkms/today/common/todayTender';
log_message("目標網站: $targetUrl");

// 確保數據目錄存在
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    if (mkdir($dataDir, 0755, true)) {
        log_message("已創建數據目錄: $dataDir");
    } else {
        log_message("錯誤：無法創建數據目錄: $dataDir");
        exit(1);
    }
}

$dataFile = $dataDir . '/tenderData.json';
log_message("數據將保存到: $dataFile");

// 抓取網頁內容
function fetchWebContent($url) {
    log_message("正在連接目標網站...");
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    curl_setopt($ch, CURLOPT_ENCODING, ''); // 接受所有支持的編碼

    // 添加模擬瀏覽器標頭
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language: zh-TW,zh;q=0.9,en;q=0.8',
        'Cache-Control: no-cache',
        'Connection: keep-alive',
        'Pragma: no-cache',
        'Upgrade-Insecure-Requests: 1'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        log_message("錯誤：抓取網頁失敗 - $error");
        return false;
    }

    if ($httpCode !== 200) {
        log_message("錯誤：HTTP 狀態碼 $httpCode");
        return false;
    }

    $contentLength = strlen($response);
    log_message("成功獲取網頁內容 ($contentLength 字節)");
    
    return $response;
}

// 解析 HTML 並提取招標資訊
function parseTenderData($html) {
    log_message("開始解析網頁內容...");
    
    // 檢查輸入
    if (empty($html)) {
        log_message("錯誤：HTML 內容為空");
        return [];
    }

    // 將 HTML 轉換為 DOM 結構
    libxml_use_internal_errors(true); // 忽略 HTML 解析錯誤
    $dom = new DOMDocument();
    $dom->encoding = 'UTF-8';
    
    // 嘗試檢測和處理字符編碼
    if (preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', $html, $matches)) {
        $charset = strtoupper($matches[1]);
        log_message("檢測到字符編碼: $charset");
        if ($charset != 'UTF-8') {
            log_message("嘗試將內容從 $charset 轉換為 UTF-8");
            $html = mb_convert_encoding($html, 'UTF-8', $charset);
        }
    }
    
    // 加載 HTML
    @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
    $xpath = new DOMXPath($dom);

    // 尋找招標表格
    $tableNodes = $xpath->query('//table[contains(@class, "tender_table")]');
    
    if ($tableNodes->length == 0) {
        log_message("錯誤：找不到招標表格 (tender_table)");
        
        // 保存 HTML 以供調試
        file_put_contents($GLOBALS['dataDir'] . '/debug_html.txt', $html);
        log_message("已保存原始 HTML 以供調試");
        
        // 嘗試查找其他表格元素
        $anyTables = $xpath->query('//table');
        log_message("網頁中共有 " . $anyTables->length . " 個表格");
        
        return [];
    }

    log_message("找到招標表格，開始提取數據");

    $items = [];
    $rows = $xpath->query('.//tr', $tableNodes->item(0));
    log_message("表格中共有 " . $rows->length . " 行");

    // 跳過表頭行
    $headerProcessed = false;
    
    foreach ($rows as $row) {
        // 第一行通常是表頭，跳過
        if (!$headerProcessed) {
            $headerProcessed = true;
            continue;
        }

        // 獲取行中的所有單元格
        $columns = $xpath->query('./td', $row);
        
        if ($columns->length >= 6) {
            // 提取數據
            $id = trim($columns->item(0)->textContent);
            $orgName = trim($columns->item(1)->textContent);
            $title = trim($columns->item(2)->textContent);
            $publishDate = trim($columns->item(3)->textContent);
            $deadline = trim($columns->item(4)->textContent);
            $budget = trim($columns->item(5)->textContent);
            
            // 提取詳情連結
            $detailUrl = '';
            $links = $xpath->query('.//a', $columns->item(2));
            if ($links->length > 0) {
                $detailUrl = $links->item(0)->getAttribute('href');
                
                // 如果連結是相對路徑，轉換為絕對路徑
                if (strpos($detailUrl, 'http') !== 0) {
                    // 從目標 URL 提取基礎 URL
                    $parsedUrl = parse_url($GLOBALS['targetUrl']);
                    $baseUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
                    
                    // 合併路徑
                    if (strpos($detailUrl, '/') === 0) {
                        $detailUrl = $baseUrl . $detailUrl;
                    } else {
                        $path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';
                        $directory = dirname($path);
                        $detailUrl = $baseUrl . $directory . '/' . $detailUrl;
                    }
                }
            }
            
            // 將數據添加到結果陣列
            $items[] = [
                'id' => $id,
                'orgName' => $orgName,
                'title' => $title,
                'publishDate' => $publishDate,
                'deadline' => $deadline,
                'budget' => $budget,
                'detailUrl' => $detailUrl
            ];
        }
    }

    log_message("成功提取 " . count($items) . " 筆招標資訊");
    return $items;
}

// 保存數據到 JSON 文件
function saveDataToJson($items, $filePath) {
    log_message("準備保存數據到 JSON 文件");

    // 檢查是否有舊數據
    $mergedData = [
        'lastUpdate' => date('Y-m-d H:i:s'),
        'items' => $items
    ];

    if (file_exists($filePath)) {
        log_message("發現現有數據文件，檢查是否需要合併");
        
        try {
            $oldData = json_decode(file_get_contents($filePath), true);
            
            // 驗證舊數據格式
            if (is_array($oldData) && isset($oldData['items']) && is_array($oldData['items'])) {
                // 如果新數據為空，保留舊數據
                if (empty($items) && !empty($oldData['items'])) {
                    log_message("警告：新抓取的數據為空，保留原有數據");
                    $mergedData = $oldData;
                    $mergedData['lastUpdate'] = date('Y-m-d H:i:s') . ' (無新數據，保留舊資料)';
                } else {
                    log_message("舊數據文件包含 " . count($oldData['items']) . " 筆記錄");
                }
            } else {
                log_message("舊數據格式無效，將被新數據替換");
            }
        } catch (Exception $e) {
            log_message("讀取舊數據時出錯：" . $e->getMessage());
        }
    }

    // 將數據寫入文件
    $jsonData = json_encode($mergedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($jsonData === false) {
        log_message("錯誤：JSON 編碼失敗 - " . json_last_error_msg());
        return false;
    }

    $result = file_put_contents($filePath, $jsonData);
    if ($result === false) {
        log_message("錯誤：無法寫入文件 $filePath");
        return false;
    }

    $itemCount = count($mergedData['items']);
    log_message("成功保存 $itemCount 筆招標資訊到 $filePath");
    return true;
}

// 主執行流程
try {
    // 步驟 1: 抓取網頁內容
    $html = fetchWebContent($targetUrl);
    if ($html === false) {
        throw new Exception("無法獲取網頁內容");
    }
    
    // 步驟 2: 解析招標數據
    $items = parseTenderData($html);
    if (empty($items)) {
        log_message("警告：未從網頁提取到任何招標資訊");
    }
    
    // 步驟 3: 保存數據到 JSON 文件
    if (!saveDataToJson($items, $dataFile)) {
        throw new Exception("保存數據失敗");
    }

    // 計算執行時間
    $executionTime = round(microtime(true) - $startTime, 2);
    log_message("程序執行完成，耗時 $executionTime 秒");
    
    // 顯示成功訊息
    echo '<div style="margin-top:20px; padding:10px; background-color:#dff0d8; color:#3c763d; border:1px solid #d6e9c6; border-radius:4px;">
        <strong>更新完成！</strong> 已成功從政府採購網站更新招標資訊。
        <a href="index.html">返回查詢系統</a>
    </div>';
    
} catch (Exception $e) {
    log_message("錯誤：" . $e->getMessage());
    
    // 顯示錯誤訊息
    echo '<div style="margin-top:20px; padding:10px; background-color:#f2dede; color:#a94442; border:1px solid #ebccd1; border-radius:4px;">
        <strong>更新失敗！</strong> ' . $e->getMessage() . '
        <a href="index.html">返回查詢系統</a>
    </div>';
    exit(1);
}
?>
