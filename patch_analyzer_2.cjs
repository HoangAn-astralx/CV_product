const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const regexUpdates = `
    // ── Hành vi chính ──
    if (/xâm\\s+nhập|đột\\s+nhập|leo\\s+trèo|lẻn\\s+vào|trốn|trèo\\s+tường/.test(lw)) { action = 'phát hiện xâm nhập/đột nhập'; add('Hành vi: Xâm nhập / đột nhập'); }
    else if (/lảng\\s+vảng|ở\\s+lại\\s+lâu|dòm\\s+ngó|đứng\\s+lâu|đứng\\s+lại|chờ/.test(lw)) { action = 'phát hiện lảng vảng/chờ đợi lâu'; add('Hành vi: Lảng vảng / chờ đợi quá lâu'); }
    else if (/đi\\s+ngược|ngược\\s+chiều|lắp\\s+ngược/.test(lw)) { action = 'cảnh báo ngược chiều/ngược hướng'; add('Hành vi: Ngược chiều / ngược hướng'); }
    else if (/che\\s+(tay|kính)|bịt|dán|tác\\s+động/.test(lw)) { action = 'phát hiện phá hoại camera'; add('Hành vi: Che/phá hoại camera'); }
    else if (/bỏ\\s+lại|vô\\s+chủ|leaving|bỏ\\s+quên/.test(lw)) { action = 'phát hiện vật thể vô chủ'; add('Hành vi: Bỏ lại đồ vật'); }
    else if (/lấy\\s+(mất|đi|trộm)|di\\s+dời|mất|gỡ\\s+xuống/.test(lw)) { action = 'cảnh báo mất cắp/di dời'; add('Hành vi: Đồ vật bị lấy mất'); }
    else if (/đếm|số\\s+lượng|count|thống\\s+kê|kiểm\\s+kê|tỷ\\s+lệ/.test(lw)) { action = 'thống kê số lượng'; add('Hành vi: Đếm số lượng / thống kê'); }
    else if (/vào\\s+ra|ra\\s+vào|đi\\s+qua/.test(lw)) { action = 'giám sát lưu lượng'; add('Hành vi: Đi qua (vào/ra)'); }
    else if (/đánh\\s+nhau|xô\\s+xát|bạo\\s+loạn|hỗn\\s+chiến|đe\\s+dọa|trấn\\s+lột/.test(lw)) { action = 'phát hiện bạo lực/đánh nhau'; add('Hành vi: Bạo lực / đe dọa'); }
    else if (/tụ\\s+tập|đám\\s+đông|đông\\s+người|ùn\\s+tắc|kẹt|ách\\s+tắc/.test(lw)) { action = 'phát hiện đám đông/ùn tắc'; add('Hành vi: Đám đông / ùn tắc'); }
    else if (/khói|cháy|lửa|ngọn\\s+lửa|tia\\s+lửa/.test(lw)) { action = 'phát hiện khói/lửa cháy'; add('Hành vi: Cháy nổ / có khói'); }
    else if (/hút\\s+thuốc/.test(lw)) { action = 'phát hiện hút thuốc'; add('Hành vi: Hút thuốc sai quy định'); }
    else if (/điện\\s+thoại/.test(lw)) { action = 'phát hiện sử dụng điện thoại'; add('Hành vi: Dùng điện thoại'); }
    else if (/mũ\\s+bảo\\s+hộ|áo\\s+phản\\s+quang|găng\\s+tay|khẩu\\s+trang|giày\\s+bảo\\s+hộ|kính\\s+hàn|áo\\s+choàng/.test(lw)) { action = 'kiểm tra đồ bảo hộ (PPE)'; add('Hành vi: Không tuân thủ đồ bảo hộ'); }
    else if (/nhãn|mã\\s+vạch|ocr|thông\\s+tin|in\\s+mờ/.test(lw)) { action = 'nhận diện và đọc nhãn'; add('Hành vi: Kiểm tra nhãn mác / OCR'); }
    else if (/vượt\\s+quá\\s+tốc\\s+độ|phóng\\s+nhanh|tốc\\s+độ/.test(lw)) { action = 'phát hiện vi phạm tốc độ'; add('Hành vi: Chạy quá tốc độ'); }
    else if (/dừng\\s+đỗ|đỗ\\s+xe/.test(lw)) { action = 'phát hiện đỗ xe sai quy định'; add('Hành vi: Dừng đỗ sai quy định'); }
    else if (/biển\\s+số|ngoại\\s+tỉnh|danh\\s+sách\\s+đen/.test(lw)) { action = 'nhận diện biển số xe'; add('Hành vi: Nhận diện biển số xe'); }
    else if (/thiếu\\s+linh\\s+kiện|sai\\s+sót|nhầm|rách|lệch|rớt|móp|kênh|nứt|dị\\s+vật/.test(lw)) { action = 'kiểm tra lỗi sản phẩm/quy trình'; add('Hành vi: Lỗi sản phẩm / quy trình'); }
    else if (/vắng\\s+mặt|lơ\\s+là|quên\\s+tắt/.test(lw)) { action = 'giám sát nhân sự/thiết bị'; add('Hành vi: Vắng mặt / lơ là / quên tắt thiết bị'); }
    else if (/xếp\\s+hàng/.test(lw)) { action = 'phát hiện hàng đợi/xếp hàng'; add('Hành vi: Khách xếp hàng dài'); }
    else if (/rửa\\s+tay|sát\\s+khuẩn/.test(lw)) { action = 'kiểm tra vệ sinh/sát khuẩn'; add('Hành vi: Không rửa tay/sát khuẩn'); }
    else if (/điểm\\s+danh|đi\\s+trễ|rời\\s+lớp/.test(lw)) { action = 'ghi nhận chuyên cần'; add('Hành vi: Điểm danh / đi trễ / rời sớm'); }
    else if (/vượt\\s+vạch|lấn\\s+chiếm|chiếm\\s+dụng|cản\\s+trở|cản\\s+lối|chặn|bít\\s+lối/.test(lw)) { action = 'phát hiện cản trở lối đi'; add('Hành vi: Cản trở / chiếm dụng không gian'); }
    else if (/ngã|vấp\\s+ngã|tai\\s+nạn/.test(lw)) { action = 'phát hiện té ngã/tai nạn'; add('Hành vi: Té ngã / tai nạn'); }
    else if (/đi\\s+lạc|khóc/.test(lw)) { action = 'phát hiện trẻ em đi lạc/khóc'; add('Hành vi: Trẻ em đi lạc'); }
    else if (/vũ\\s+khí|gậy\\s+gộc|sắc\\s+nhọn/.test(lw)) { action = 'phát hiện mang vũ khí'; add('Hành vi: Mang vũ khí / vật nguy hiểm'); }
    else if (/bán\\s+hàng\\s+rong/.test(lw)) { action = 'phát hiện bán hàng rong'; add('Hành vi: Bán hàng rong'); }
    else if (/ho|hắt\\s+hơi/.test(lw)) { action = 'giám sát dịch tễ'; add('Hành vi: Ho / hắt hơi'); }
    else if (/thò\\s+tay|chui\\s+vào/.test(lw)) { action = 'phát hiện hành vi nguy hiểm'; add('Hành vi: Thò tay/chui vào máy móc'); }

    // ── Đối tượng giám sát ──
    if (/người\\s+lạ|kẻ\\s+gian|đối\\s+tượng\\s+khả\\s+nghi|đối\\s+tượng/.test(lw)) { target = 'đối tượng lạ/nghi vấn'; add('Đối tượng: Người lạ / khả nghi'); }
    else if (/nhân\\s+viên|bảo\\s+vệ|công\\s+nhân|người|bác\\s+sĩ|y\\s+tế|tài\\s+xế|thợ|shipper/.test(lw)) { target = 'nhân sự/con người'; add('Đối tượng: Người / Nhân sự / Y tế'); }
    else if (/khách\\s+hàng|khách|bệnh\\s+nhân|học\\s+sinh|phụ\\s+huynh|trẻ\\s+em/.test(lw)) { target = 'người ra vào'; add('Đối tượng: Khách / Bệnh nhân / Học sinh / Trẻ em'); }
    else if (/xe\\s+máy|ô\\s+tô|oto|x[eê]\\s+tải|xe|container/.test(lw)) { target = 'phương tiện giao thông'; add('Đối tượng: Xe / Phương tiện'); }
    else if (/vali|túi\\s+xách|ba\\s+lô|balo|hành\\s+lý|cặp/.test(lw)) { target = 'hành lý/túi xách'; add('Vật thể: Hành lý / túi xách'); }
    else if (/thùng\\s+hàng|kiện\\s+hàng|gói\\s+hàng|pallet|bao\\s+tải/.test(lw)) { target = 'thùng hàng/kiện hàng'; add('Vật thể: Kiện hàng / pallet / bao tải'); }
    else if (/laptop|thiết\\s+bị|máy\\s+tính|máy\\s+chiếu/.test(lw)) { target = 'thiết bị điện tử'; add('Vật thể: Thiết bị điện/điện tử'); }
    else if (/bình\\s+chữa\\s+cháy/.test(lw)) { target = 'bình chữa cháy'; add('Vật thể: Bình chữa cháy'); }
    else if (/rác|vật\\s+phế\\s+thải|phế\\s+liệu/.test(lw)) { target = 'rác/phế thải'; add('Vật thể: Rác / phế thải'); }
    else if (/sản\\s+phẩm|chai|lọ|linh\\s+kiện/.test(lw)) { target = 'sản phẩm/linh kiện'; add('Đối tượng: Sản phẩm / linh kiện'); }
    else if (/hàng\\s+cồng\\s+kềnh|xe\\s+đẩy/.test(lw)) { target = 'xe đẩy/hàng cồng kềnh'; add('Vật thể: Xe đẩy / hàng cồng kềnh'); }
    else if (/tủ\\s+điện|máy\\s+móc|máy\\s+ép|lưỡi\\s+cưa|cần\\s+cẩu/.test(lw)) { target = 'máy móc/thiết bị nặng'; add('Vật thể: Máy móc / thiết bị nặng'); }

    // ── Khu vực cụ thể ──
    const places: [RegExp, string][] = [
      [/kho\\s+hàng|kho\\s+bãi|nhà\\s+xưởng|kho|xưởng|chuyền|băng\\s+chuyền|băng\\s+tải/, 'nhà xưởng/dây chuyền/kho'],
      [/cổng\\s+\\w+|cổng/, 'cổng'],
      [/cửa\\s+(kho|thoát\\s*hiểm|phòng\\s+server|hàng|khám|dock)|cửa/, 'cửa'],
      [/tường\\s+rào/, 'tường rào'],
      [/bãi\\s+đỗ|bãi\\s+xe|nhà\\s+xe|trạm|dock/, 'bãi đỗ xe/trạm'],
      [/sảnh|lobby|lễ\\s+tân|quầy/, 'khu vực sảnh/quầy'],
      [/hành\\s+lang|lối\\s+đi/, 'hành lang/lối đi'],
      [/lối\\s+thoát/, 'lối thoát hiểm'],
      [/thang\\s+máy|thang\\s+cuốn|cầu\\s+thang/, 'thang máy/thang bộ'],
      [/cây\\s+atm|atm/, 'cây ATM'],
      [/đường\\s+băng|khoang\\s+hành\\s+lý/, 'khu vực hàng không'],
      [/phòng\\s+mổ|buồng\\s+bệnh|cách\\s+ly|nội\\s+tổng\\s+hợp|y\\s+tế|cấp\\s+cứu/, 'khu vực y tế'],
      [/lớp\\s+học|sân\\s+trường|khuôn\\s+viên\\s+trường|nhà\\s+vệ\\s+sinh/, 'khu vực trường học/nội bộ'],
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
