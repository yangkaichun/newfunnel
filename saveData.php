<?php
// saveData.php - 保存數據到 JSON 文件

// 允許跨域請求
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// 檢查請求方法
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '僅支持 POST 請求']);
    exit;
}

// 獲取原始 POST 數據
$rawPostData = file_get_contents("php://input");
if (empty($rawPostData)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '沒有接收到數據']);
    exit;
}

// 解析 JSON 數據
$data = json_decode($rawPostData, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'JSON 解析錯誤: ' . json_last_error_msg()]);
    exit;
}

// 驗證數據格式
if (!isset($data['items']) || !is_array($data['items'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '數據格式錯誤，缺少 items 陣列']);
    exit;
}

// 確保數據目錄存在
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    if (!mkdir($dataDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '無法創建數據目錄']);
        exit;
    }
}

// 設置文件路徑
$filePath = $dataDir . '/tenderData.json';

// 設置上次更新時間（如果客戶端未提供）
if (!isset($data['lastUpdate']) || empty($data['lastUpdate'])) {
    $data['lastUpdate'] = date('Y-m-d H:i:s');
}

// 如果文件存在，嘗試合併舊數據
$mergedData = $data;
if (file_exists($filePath)) {
    $oldData = json_decode(file_get_contents($filePath), true);
    
    // 如果舊數據有效且新數據為空，保留舊數據
    if ($oldData && isset($oldData['items']) && is_array($oldData['items']) && empty($data['items'])) {
        $mergedData = $oldData;
        $mergedData['lastUpdate'] = date('Y-m-d H:i:s') . ' (無新數據，保留舊資料)';
    }
}

try {
    // 將數據保存為 JSON 文件
    $jsonData = json_encode($mergedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($jsonData === false) {
        throw new Exception('JSON 編碼錯誤: ' . json_last_error_msg());
    }
    
    // 寫入文件
    if (file_put_contents($filePath, $jsonData) === false) {
        throw new Exception('無法寫入文件');
    }
    
    // 返回成功訊息
    echo json_encode([
        'success' => true,
        'message' => '數據已成功保存',
        'file' => basename($filePath),
        'itemCount' => count($mergedData['items']),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '保存數據時發生錯誤: ' . $e->getMessage()]);
}
