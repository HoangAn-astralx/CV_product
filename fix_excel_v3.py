import openpyxl

wb = openpyxl.load_workbook('VisionOS_MVP.xlsx')
ws = wb['Tính năng']

updated_count = 0
for row in ws.iter_rows():
    for cell in row:
        if isinstance(cell.value, str):
            if "Sau mô tả" in cell.value and "Vẽ vạch" in cell.value:
                cell.value = "Quy trình thiết lập UI 4 bước: 1. Chọn Camera → 2. Mô tả bài toán/Chọn Model → 3. Khoanh vùng/Vẽ vạch → 4. Chọn kênh cảnh báo → Pipeline chạy."
                updated_count += 1
            elif "Mô tả bài toán bằng tiếng Việt" in cell.value and "Hệ thống tự chọn AI" in cell.value:
                cell.value = "Quy trình hướng dẫn từng bước. Hệ thống tự chọn AI model dựa trên mô tả tiếng Việt. Tích hợp cấu hình Vùng/Vạch và Đa kênh cảnh báo (Webhook, Zalo, Email) → Tự động chạy realtime."
                updated_count += 1

wb.save('VisionOS_MVP.xlsx')
print(f"Excel updated! Modified {updated_count} cells.")
