<?php
// proxy.php - 獲取原始網站內容的代理腳本

// 允許跨域請求
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');

// 獲取要爬取的URL
$url = isset($_GET['url']) ? $_GET['url'] : '';

// 驗證 URL
if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo '無效的 URL';
    exit;
}

// 防止代理本地文件或內部網絡資源
$host = parse_url($url, PHP_URL_HOST);
if (filter_var($host, FILTER_VALIDATE_IP)) {
    $ip = inet_pton($host);
    if (!$ip) {
        http_response_code(403);
        echo '不允許訪問該 IP';
        exit;
    }
    
    // 檢查是否為本地或內部網絡 IP
    if (
        // IPv4: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        ($ip[0] === "\x7F" || $ip[0] === "\x0A" || ($ip[0] === "\xAC" && ($ip[1] & "\xF0") === "\x10") || ($ip[0] === "\xC0" && $ip[1] === "\xA8")) ||
        // IPv6: ::1/128 (本地環回)
        ($ip === "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01")
    ) {
        http_response_code(403);
        echo '不允許訪問本地或內部網絡';
        exit;
    }
}

// 只允許爬取政府採購網站
$allowedDomain = 'web.pcc.gov.tw';
if (strpos($host, $allowedDomain) === false) {
    http_response_code(403);
    echo '僅允許爬取政府採購網站';
    exit;
}

// 設置 cURL 選項
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

// 執行請求
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// 檢查錯誤
if ($error) {
    http_response_code(500);
    echo '抓取數據時發生錯誤: ' . $error;
    exit;
}

// 檢查 HTTP 狀態碼
if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo '原始網站返回錯誤狀態碼: ' . $httpCode;
    exit;
}

// 輸出內容
echo $response;
