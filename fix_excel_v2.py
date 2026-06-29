import openpyxl

wb = openpyxl.load_workbook('VisionOS_MVP.xlsx')
ws = wb.active

updated_count = 0
for row in ws.iter_rows():
    for cell in row:
        if isinstance(cell.value, str):
            if "Sau mô tả" in cell.value and "Vẽ vạch" in cell.value:
                cell.value = "Quy trình thiết lập (UI 4 bước): Chọn Camera → Mô tả bài toán → Vẽ vạch/vùng → Chọn kênh cảnh báo → Pipeline chạy."
                updated_count += 1
            elif "Mô tả bài toán bằng tiếng Việt" in cell.value and "Hệ thống tự chọn AI" in cell.value:
                cell.value = "Mô tả bài toán bằng tiếng Việt. Hệ thống tự chọn AI. Chọn Camera, vẽ vùng và cấu hình kênh cảnh báo (Webhook, Zalo, Email) → Pipeline tự động chạy realtime."
                updated_count += 1

wb.save('VisionOS_MVP.xlsx')
print(f"Excel updated! Modified {updated_count} cells.")
