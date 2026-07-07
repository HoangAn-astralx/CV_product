const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const inferUpdates = `
    const lw = text.toLowerCase();
    const hasPpe = ['mũ', 'áo phản quang', 'bảo hộ', 'ppe', 'an toàn', 'găng tay', 'khẩu trang'].some(k => lw.includes(k));
    const hasVehicle = ['xe', 'ô tô', 'oto', 'xe máy', 'motorcycle', 'truck', 'tải', 'biển số'].some(k => lw.includes(k));
    const hasPerson = ['người', 'khách', 'nhân viên', 'công nhân', 'person', 'bác sĩ', 'học sinh', 'phụ huynh', 'tài xế', 'bảo vệ'].some(k => lw.includes(k));
    const asksCount = ['đếm', 'số lượng', 'bao nhiêu', 'count', 'thống kê', 'kiểm kê', 'tỷ lệ'].some(k => lw.includes(k));
    const usesLine = ['vào ra', 'ra vào', 'đi qua', 'qua cổng', 'cross', 'line', 'lên tầng'].some(k => lw.includes(k));
    const usesExit = ['rời khỏi', 'đi ra', 'exit', 'trốn'].some(k => lw.includes(k));
    const usesIntrusion = ['xâm nhập', 'đi vào', 'vào khu vực', 'enter', 'leo trèo', 'lẻn vào', 'vượt rào'].some(k => lw.includes(k));
    const usesLoiter = ['lảng vảng', 'ở lại lâu', 'loiter', 'quá lâu', 'đứng lâu', 'chờ', 'xếp hàng', 'tụ tập', 'đám đông'].some(k => lw.includes(k));
    const hasDefect = ['lỗi', 'móp', 'rách', 'xước', 'hỏng', 'defect', 'nhãn lệch', 'thiếu linh kiện', 'sai sót', 'nhầm', 'rớt'].some(k => lw.includes(k));
    const hasAbandoned = ['bỏ lại', 'leaving', 'balo', 'ba lô', 'túi', 'vali', 'thùng hàng', 'pallet'].some(k => lw.includes(k));
    const hasRemoval = ['lấy hàng', 'lấy khỏi', 'remove', 'mất', 'trộm', 'cậy phá', 'gỡ xuống'].some(k => lw.includes(k));
    const hasFire = ['khói', 'cháy', 'lửa', 'ngọn lửa', 'hút thuốc'].some(k => lw.includes(k));
    const hasPhone = ['điện thoại'].some(k => lw.includes(k));
    const hasFight = ['đánh nhau', 'xô xát', 'bạo lực', 'bạo loạn', 'hỗn chiến'].some(k => lw.includes(k));
    const usesKnownTarget = hasPerson || hasVehicle;
    const needsOpen = hasPpe || hasDefect || hasAbandoned || hasRemoval || hasFire || hasPhone || hasFight || (!usesKnownTarget && text.trim().length > 0);
`;

const startMarker = "const lw = text.toLowerCase();";
const endMarker = "if (!needsOpen && usesKnownTarget) {";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + inferUpdates + '\n    ' + content.substring(endIndex);
  fs.writeFileSync('src/components/PipelineBuilder.tsx', content, 'utf8');
} else {
  console.log('Could not find markers');
}
