import openpyxl

wb = openpyxl.load_workbook('VisionOS_MVP.xlsx')
ws = wb.active

# Let's find the cell with "Sau mô tả → Vẽ vạch/vùng → Chọn kênh cảnh báo → Pipeline chạy."
# We will update it to match the UI: "Chọn Camera → Mô tả bài toán → Vẽ vạch/vùng → Chọn kênh cảnh báo → Pipeline chạy."

for row in ws.iter_rows():
    for cell in row:
        if isinstance(cell.value, str):
            if "Sau mô tả → Vẽ vạch/vùng → Chọn kênh cảnh báo → Pipeline chạy." in cell.value:
                cell.value = "Quy trình thiết lập (UI UI 4 bước): Chọn Camera → Mô tả bài toán → Vẽ vạch/vùng → Chọn kênh cảnh báo → Pipeline chạy."
            elif "Mô tả bài toán bằng tiếng Việt. Hệ thống tự chọn AI. Cấu hình xong → pipeline tự chạy realtime." in cell.value:
                cell.value = "Mô tả bài toán bằng tiếng Việt. Hệ thống tự chọn AI. Chọn Camera, vẽ vùng và cấu hình kênh cảnh báo (Webhook, Zalo, Email) → Pipeline tự động chạy realtime."

wb.save('VisionOS_MVP.xlsx')
print("Excel updated!")
