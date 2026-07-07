const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const regexUpdates = `
    // ── Hành vi chính ──
    if (/xâm\\s+nhập|đột\\s+nhập|leo\\s+trèo|lẻn\\s+vào|trốn/.test(lw)) { action = 'phát hiện xâm nhập/đột nhập'; add('Hành vi: Xâm nhập / đột nhập'); }
    else if (/lảng\\s+vảng|ở\\s+lại\\s+lâu|dòm\\s+ngó|đứng\\s+lâu|đứng\\s+lại|chờ/.test(lw)) { action = 'phát hiện lảng vảng/chờ đợi lâu'; add('Hành vi: Lảng vảng / chờ đợi quá lâu'); }
    else if (/đi\\s+ngược|ngược\\s+chiều/.test(lw)) { action = 'cảnh báo đi ngược chiều'; add('Hành vi: Đi ngược chiều'); }
    else if (/che\\s+(tay|kính)|bịt|dán|tác\\s+động/.test(lw)) { action = 'phát hiện phá hoại camera'; add('Hành vi: Che/phá hoại camera'); }
    else if (/bỏ\\s+lại|vô\\s+chủ|leaving|bỏ\\s+quên/.test(lw)) { action = 'phát hiện vật thể vô chủ'; add('Hành vi: Bỏ lại đồ vật'); }
    else if (/lấy\\s+(mất|đi|trộm)|di\\s+dời|mất|gỡ\\s+xuống/.test(lw)) { action = 'cảnh báo mất cắp/di dời'; add('Hành vi: Đồ vật bị lấy mất'); }
    else if (/đếm|số\\s+lượng|count|thống\\s+kê|kiểm\\s+kê|tỷ\\s+lệ/.test(lw)) { action = 'thống kê số lượng'; add('Hành vi: Đếm số lượng / thống kê'); }
    else if (/vào\\s+ra|ra\\s+vào|đi\\s+qua/.test(lw)) { action = 'giám sát lưu lượng'; add('Hành vi: Đi qua (vào/ra)'); }
    else if (/đánh\\s+nhau|xô\\s+xát|bạo\\s+loạn|hỗn\\s+chiến/.test(lw)) { action = 'phát hiện bạo lực/đánh nhau'; add('Hành vi: Đánh nhau / bạo loạn'); }
    else if (/tụ\\s+tập|đám\\s+đông|đông\\s+người|ùn\\s+tắc|kẹt/.test(lw)) { action = 'phát hiện đám đông/ùn tắc'; add('Hành vi: Đám đông / ùn tắc'); }
    else if (/khói|cháy|lửa|ngọn\\s+lửa/.test(lw)) { action = 'phát hiện khói/lửa cháy'; add('Hành vi: Cháy nổ / có khói'); }
    else if (/hút\\s+thuốc/.test(lw)) { action = 'phát hiện hút thuốc'; add('Hành vi: Hút thuốc sai quy định'); }
    else if (/điện\\s+thoại/.test(lw)) { action = 'phát hiện sử dụng điện thoại'; add('Hành vi: Dùng điện thoại'); }
    else if (/mũ\\s+bảo\\s+hộ|áo\\s+phản\\s+quang|găng\\s+tay|khẩu\\s+trang/.test(lw)) { action = 'kiểm tra đồ bảo hộ (PPE)'; add('Hành vi: Không tuân thủ đồ bảo hộ'); }
    else if (/nhãn|mã\\s+vạch|ocr|thông\\s+tin/.test(lw)) { action = 'nhận diện và đọc nhãn'; add('Hành vi: Kiểm tra nhãn mác / OCR'); }
    else if (/vượt\\s+quá\\s+tốc\\s+độ|phóng\\s+nhanh|tốc\\s+độ/.test(lw)) { action = 'phát hiện vi phạm tốc độ'; add('Hành vi: Chạy quá tốc độ'); }
    else if (/dừng\\s+đỗ|đỗ\\s+xe/.test(lw)) { action = 'phát hiện đỗ xe sai quy định'; add('Hành vi: Dừng đỗ sai quy định'); }
    else if (/biển\\s+số/.test(lw)) { action = 'nhận diện biển số xe'; add('Hành vi: Đọc biển số xe'); }
    else if (/thiếu\\s+linh\\s+kiện|sai\\s+sót|nhầm|rách|lệch|rớt/.test(lw)) { action = 'kiểm tra lỗi sản phẩm/quy trình'; add('Hành vi: Lỗi sản phẩm / quy trình'); }
    else if (/vắng\\s+mặt|lơ\\s+là/.test(lw)) { action = 'giám sát nhân sự'; add('Hành vi: Vắng mặt / lơ là công việc'); }
    else if (/xếp\\s+hàng|chờ/.test(lw)) { action = 'phát hiện hàng đợi/xếp hàng'; add('Hành vi: Khách xếp hàng dài / chờ lâu'); }
    else if (/rửa\\s+tay|sát\\s+khuẩn/.test(lw)) { action = 'kiểm tra vệ sinh/sát khuẩn'; add('Hành vi: Không rửa tay/sát khuẩn'); }
    else if (/điểm\\s+danh|đi\\s+trễ/.test(lw)) { action = 'ghi nhận chuyên cần'; add('Hành vi: Điểm danh / đi trễ'); }

    // ── Đối tượng giám sát ──
    if (/người\\s+lạ|kẻ\\s+gian|đối\\s+tượng\\s+khả\\s+nghi|đối\\s+tượng/.test(lw)) { target = 'đối tượng lạ/nghi vấn'; add('Đối tượng: Người lạ / khả nghi'); }
    else if (/nhân\\s+viên|bảo\\s+vệ|công\\s+nhân|người|bác\\s+sĩ|y\\s+tế|tài\\s+xế/.test(lw)) { target = 'nhân sự/con người'; add('Đối tượng: Người / Nhân sự / Y tế'); }
    else if (/khách\\s+hàng|khách|bệnh\\s+nhân|học\\s+sinh|phụ\\s+huynh/.test(lw)) { target = 'người ra vào'; add('Đối tượng: Khách / Bệnh nhân / Học sinh'); }
    else if (/xe\\s+máy|ô\\s+tô|oto|x[eê]\\s+tải|xe/.test(lw)) { target = 'phương tiện giao thông'; add('Đối tượng: Xe / Phương tiện'); }
    else if (/vali|túi\\s+xách|ba\\s+lô|balo|hành\\s+lý/.test(lw)) { target = 'hành lý/túi xách'; add('Vật thể: Hành lý / túi xách'); }
    else if (/thùng\\s+hàng|kiện\\s+hàng|gói\\s+hàng|pallet/.test(lw)) { target = 'thùng hàng/kiện hàng'; add('Vật thể: Kiện hàng / pallet'); }
    else if (/laptop|thiết\\s+bị|máy\\s+tính/.test(lw)) { target = 'thiết bị điện tử'; add('Vật thể: Thiết bị điện tử'); }
    else if (/bình\\s+chữa\\s+cháy/.test(lw)) { target = 'bình chữa cháy'; add('Vật thể: Bình chữa cháy'); }
    else if (/rác|vật\\s+phế\\s+thải/.test(lw)) { target = 'rác/phế thải'; add('Vật thể: Rác / phế thải'); }
    else if (/sản\\s+phẩm|chai|lọ|linh\\s+kiện/.test(lw)) { target = 'sản phẩm/linh kiện'; add('Đối tượng: Sản phẩm / linh kiện'); }

    // ── Khu vực cụ thể ──
    const places: [RegExp, string][] = [
      [/kho\\s+hàng|kho\\s+bãi|nhà\\s+xưởng|kho|xưởng|chuyền|băng\\s+chuyền|trạm/, 'nhà xưởng/dây chuyền/kho'],
      [/cổng\\s+\\w+|cổng/, 'cổng'],
      [/cửa\\s+(kho|thoát\\s*hiểm|phòng\\s+server|hàng|khám)|cửa/, 'cửa'],
      [/tường\\s+rào/, 'tường rào'],
      [/bãi\\s+đỗ|bãi\\s+xe|nhà\\s+xe/, 'bãi đỗ xe'],
      [/sảnh|lobby|lễ\\s+tân|quầy/, 'khu vực sảnh/quầy'],
      [/hành\\s+lang/, 'hành lang'],
      [/lối\\s+thoát|lối\\s+đi/, 'lối đi/lối thoát hiểm'],
      [/thang\\s+máy|thang\\s+cuốn/, 'thang máy/thang cuốn'],
      [/cây\\s+atm|atm/, 'cây ATM'],
      [/đường\\s+băng|khoang\\s+hành\\s+lý/, 'khu vực hàng không'],
      [/phòng\\s+mổ|buồng\\s+bệnh|cách\\s+ly|nội\\s+tổng\\s+hợp|y\\s+tế/, 'khu vực y tế'],
      [/lớp\\s+học|sân\\s+trường|khuôn\\s+viên\\s+trường/, 'khu vực trường học'],
      [/kệ|rack/, 'kệ hàng'],
      [/khu\\s+vực\\s+(cấm|nguy\\s*hiểm|điện\\s+cao\\s+thế|thi\\s+công|bảo\\s+vệ)|trạm\\s+biến\\s+áp|công\\s+trường/, 'khu vực hạn chế'],
    ];`;

const startMarker = "// ── Hành vi chính ──";
const endMarker = "// ── Thời gian cụ thể ──";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + regexUpdates + '\n\n    ' + content.substring(endIndex);
  fs.writeFileSync('src/components/PipelineBuilder.tsx', content, 'utf8');
} else {
  console.log('Could not find markers');
}
