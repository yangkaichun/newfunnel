#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import datetime
import requests
from bs4 import BeautifulSoup
import pytz

# 設置台灣時區
tw_timezone = pytz.timezone('Asia/Taipei')

def log_message(message):
    """輸出日誌訊息"""
    current_time = datetime.datetime.now(tw_timezone).strftime('[%Y-%m-%d %H:%M:%S]')
    print(f"{current_time} {message}")

def fetch_website():
    """抓取政府採購招標網站的內容"""
    log_message("開始抓取網頁內容...")
    
    url = 'https://web.pcc.gov.tw/prkms/today/common/todayTender'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=60)
        response.raise_for_status()  # 如果狀態碼不是 200 則拋出異常
        log_message(f"成功取得網頁內容，大小: {len(response.content)} 字節")
        return response.text
    except Exception as e:
        log_message(f"抓取網頁失敗: {str(e)}")
        return None

def parse_tender_data(html_content):
    """解析 HTML 並提取招標資訊"""
    if not html_content:
        return []
    
    log_message("開始解析網頁內容...")
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 尋找招標表格
    tender_table = soup.select_one('table.tender_table')
    if not tender_table:
        log_message("錯誤: 找不到招標表格")
        return []
    
    # 提取表格行
    rows = tender_table.select('tbody tr')
    log_message(f"找到 {len(rows)} 行資料")
    
    items = []
    
    # 跳過表頭行
    for row in rows[1:]:
        cells = row.select('td')
        if len(cells) >= 6:
            # 提取詳情連結
            detail_link = cells[2].select_one('a')
            detail_url = detail_link.get('href', '') if detail_link else ''
            
            # 如果是相對連結，加上基礎 URL
            if detail_url and not detail_url.startswith(('http://', 'https://')):
                base_url = 'https://web.pcc.gov.tw'
                if detail_url.startswith('/'):
                    detail_url = base_url + detail_url
                else:
                    detail_url = base_url + '/prkms/today/common/' + detail_url
            
            # 組織招標資訊項目
            tender_item = {
                'id': cells[0].get_text().strip(),
                'orgName': cells[1].get_text().strip(),
                'title': cells[2].get_text().strip(),
                'publishDate': cells[3].get_text().strip(),
                'deadline': cells[4].get_text().strip(),
                'budget': cells[5].get_text().strip(),
                'detailUrl': detail_url
            }
            items.append(tender_item)
    
    log_message(f"成功提取 {len(items)} 筆招標資訊")
    return items

def save_data(items):
    """保存數據到 JSON 文件"""
    log_message("準備保存數據...")
    
    # 確保數據目錄存在
    data_dir = os.path.join(os.getcwd(), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        log_message(f"創建數據目錄: {data_dir}")
    
    data_file = os.path.join(data_dir, 'tenderData.json')
    
    # 如果項目為空，檢查是否有舊數據
    if not items and os.path.exists(data_file):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                if 'items' in old_data and old_data['items']:
                    log_message("新數據為空，保留舊數據")
                    return
        except Exception as e:
            log_message(f"讀取舊數據失敗: {str(e)}")
    
    # 創建數據對象
    data_obj = {
        'lastUpdate': datetime.datetime.now(tw_timezone).strftime('%Y-%m-%d %H:%M:%S'),
        'items': items
    }
    
    # 寫入文件
    try:
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(data_obj, f, ensure_ascii=False, indent=2)
        log_message(f"成功保存 {len(items)} 筆招標資訊到 {data_file}")
    except Exception as e:
        log_message(f"保存數據失敗: {str(e)}")

def main():
    """主函數"""
    log_message("開始執行招標資訊更新程序")
    
    # 抓取網頁內容
    html_content = fetch_website()
    
    # 如果成功獲取網頁內容
    if html_content:
        # 解析招標資訊
        items = parse_tender_data(html_content)
        
        # 保存數據
        save_data(items)
    
    log_message("程序執行完成")

if __name__ == "__main__":
    main()
