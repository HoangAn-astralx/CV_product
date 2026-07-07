const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const newSuggestions = `
  tra_alpr: [
    { id: 't_alpr1', name: 'Đọc biển số cổng chính', description: 'Nhận diện tự động biển số các phương tiện ra vào cổng chính' },
    { id: 't_alpr2', name: 'Cảnh báo biển số đen', description: 'Cảnh báo khi phát hiện xe nằm trong danh sách đen tiến vào' }
  ],
  tra_count: [
    { id: 't_cnt1', name: 'Đếm xe qua vạch', description: 'Đếm số lượng ô tô và xe máy đi qua vạch đếm' },
    { id: 't_cnt2', name: 'Thống kê lượng xe tải', description: 'Đếm và thống kê số chuyến xe tải chở hàng ra vào' }
  ],
  tra_parking: [
    { id: 't_pk1', name: 'Dừng đỗ trái phép', description: 'Cảnh báo xe ô tô dừng đỗ tại khu vực cấm đỗ trước sảnh' },
    { id: 't_pk2', name: 'Đỗ xe quá giờ', description: 'Phát hiện xe đỗ tại khu vực bốc dỡ hàng quá 15 phút' }
  ],
  tra_speed: [
    { id: 't_sp1', name: 'Chạy quá tốc độ', description: 'Cảnh báo xe chạy vượt quá 40km/h trong khu dân cư' },
    { id: 't_sp2', name: 'Xe máy phóng nhanh', description: 'Phát hiện xe máy chạy tốc độ cao tại khu vực giao lộ' }
  ],
  prd_label: [
    { id: 'p_lb1', name: 'Kiểm tra dán nhãn', description: 'Phát hiện sản phẩm bị dán nhãn lệch hoặc rách bao bì' },
    { id: 'p_lb2', name: 'Đọc mã vạch/OCR', description: 'Đọc văn bản và mã vạch trên nhãn để xác nhận thông tin' }
  ],
  prd_assembly: [
    { id: 'p_as1', name: 'Kiểm tra linh kiện', description: 'Cảnh báo bảng mạch thiếu linh kiện hoặc lắp ráp sai vị trí' },
    { id: 'p_as2', name: 'Sai sót công đoạn', description: 'Phát hiện công nhân bỏ qua bước siết ốc trên dây chuyền' }
  ],
  prd_counting: [
    { id: 'p_cn1', name: 'Đếm thùng hàng', description: 'Đếm số lượng thùng carton chạy qua băng chuyền' },
    { id: 'p_cn2', name: 'Đếm sản phẩm đóng gói', description: 'Đếm chính xác số chai/lọ thành phẩm trước khi đóng thùng' }
  ],
  prd_productivity: [
    { id: 'p_pd1', name: 'Đo lường thời gian trễ', description: 'Tính toán thời gian băng chuyền dừng hoạt động' },
    { id: 'p_pd2', name: 'Phân tích nhịp độ', description: 'Theo dõi tốc độ làm việc trung bình của công nhân tại trạm' }
  ],
  hse_ppe: [
    { id: 'h_pp1', name: 'Thiếu mũ bảo hộ', description: 'Cảnh báo công nhân không đội mũ bảo hộ tại công trường' },
    { id: 'h_pp2', name: 'Không mặc áo phản quang', description: 'Phát hiện người không mặc áo phản quang vào khu vực máy xúc' }
  ],
  hse_machine: [
    { id: 'h_mc1', name: 'Đứng gần máy ép', description: 'Cảnh báo khi người lao động đứng quá gần khu vực dập cắt' },
    { id: 'h_mc2', name: 'Vượt rào chắn an toàn', description: 'Phát hiện nhân viên bước qua vạch vàng cảnh báo an toàn' }
  ],
  hse_fight: [
    { id: 'h_fg1', name: 'Đánh nhau tại xưởng', description: 'Phát hiện hành vi ẩu đả, xô xát giữa các công nhân' },
    { id: 'h_fg2', name: 'Bạo lực tại cổng', description: 'Cảnh báo xô xát xảy ra khu vực kiểm soát ra vào' }
  ],
  hse_phone: [
    { id: 'h_ph1', name: 'Dùng điện thoại khi lái xe', description: 'Phát hiện tài xế xe nâng đang sử dụng điện thoại' },
    { id: 'h_ph2', name: 'Dùng điện thoại tại chuyền', description: 'Cảnh báo công nhân bấm điện thoại trong giờ làm việc' }
  ],
  hse_proximity: [
    { id: 'h_pr1', name: 'Người lại gần xe nâng', description: 'Báo động khi có người đi bộ đến gần xe nâng đang hoạt động' },
    { id: 'h_pr2', name: 'Xung đột giao thông xưởng', description: 'Cảnh báo xe điện và người đi bộ sắp va chạm tại ngã tư xưởng' }
  ],
  fir_fire: [
    { id: 'f_fi1', name: 'Phát hiện khói', description: 'Cảnh báo sớm khi có khói đen bốc lên từ khu vực kho bãi' },
    { id: 'f_fi2', name: 'Phát hiện ngọn lửa', description: 'Phát hiện ngọn lửa bùng phát tại khu vực chứa hóa chất' }
  ],
  fir_smoking: [
    { id: 'f_sm1', name: 'Hút thuốc trong xưởng', description: 'Cảnh báo nhân viên hút thuốc tại khu vực cấm lửa' },
    { id: 'f_sm2', name: 'Hút thuốc kho chứa', description: 'Phát hiện người cầm điếu thuốc đang cháy ở kho bao bì' }
  ],
  fir_exit: [
    { id: 'f_ex1', name: 'Vật cản lối thoát hiểm', description: 'Cảnh báo khi có thùng hàng đặt chắn ngang lối thoát hiểm' },
    { id: 'f_ex2', name: 'Cửa thoát hiểm bị khóa', description: 'Phát hiện hành vi khóa hoặc chốt chặt cửa thoát hiểm khẩn cấp' }
  ],
  ret_counting: [
    { id: 'r_cn1', name: 'Đếm khách vào ra', description: 'Thống kê lượng khách hàng đi qua cửa chính cửa hàng' },
    { id: 'r_cn2', name: 'Khách hàng lên tầng', description: 'Đếm số lượng khách sử dụng thang cuốn để lên tầng 2' }
  ],
  ret_heatmap: [
    { id: 'r_hm1', name: 'Bản đồ nhiệt quầy', description: 'Phân tích vùng khách hàng tập trung đông nhất tại quầy mỹ phẩm' },
    { id: 'r_hm2', name: 'Điểm nóng lối đi', description: 'Xác định các kệ hàng thu hút nhiều người dừng lại xem nhất' }
  ],
  ret_shelf: [
    { id: 'r_sh1', name: 'Kệ hàng trống', description: 'Cảnh báo nhân viên khi kệ trưng bày nước giải khát hết hàng' },
    { id: 'r_sh2', name: 'Hàng hóa lộn xộn', description: 'Phát hiện tình trạng hàng hóa bị đổ gãy, sai vị trí trên kệ' }
  ],
  ret_queue: [
    { id: 'r_qu1', name: 'Hàng đợi thanh toán', description: 'Cảnh báo khi có hơn 5 khách hàng đang xếp hàng chờ thanh toán' },
    { id: 'r_qu2', name: 'Chờ tại quầy dịch vụ', description: 'Phát hiện khách hàng đứng chờ quá lâu tại quầy tư vấn' }
  ],
  ret_crowdanalysis: [
    { id: 'r_ca1', name: 'Nhân khẩu học khách', description: 'Thống kê tỷ lệ nam/nữ và độ tuổi ước lượng của khách mua sắm' },
    { id: 'r_ca2', name: 'Nhận diện khách VIP', description: 'Nhận diện nhanh chóng khách hàng VIP khi bước vào cửa hàng' }
  ],
  ret_staff_absence: [
    { id: 'r_sa1', name: 'Vắng mặt tại quầy', description: 'Cảnh báo khi quầy thu ngân không có nhân viên trực quá 3 phút' },
    { id: 'r_sa2', name: 'Nhân viên lơ là', description: 'Phát hiện nhân viên không đứng đúng vị trí phân công' }
  ],
  wh_forklift: [
    { id: 'w_fl1', name: 'Xe nâng chạy quá tốc độ', description: 'Cảnh báo xe nâng di chuyển quá tốc độ trong kho hẹp' },
    { id: 'w_fl2', name: 'Xe nâng sai tuyến', description: 'Phát hiện xe nâng đi vào khu vực dành riêng cho người đi bộ' }
  ],
  wh_wrongzone: [
    { id: 'w_wz1', name: 'Để kiện hàng sai bãi', description: 'Phát hiện pallet xếp nhầm vào khu vực xuất hàng đi quốc tế' },
    { id: 'w_wz2', name: 'Đỗ xe sai làn bốc dỡ', description: 'Cảnh báo xe tải đỗ vào bãi xuất hàng khi chưa đến lượt' }
  ],
  wh_inventory: [
    { id: 'w_iv1', name: 'Kiểm kê pallet tự động', description: 'Quét và đếm số lượng pallet đang tồn tại trên kệ kệ Rack' },
    { id: 'w_iv2', name: 'Thống kê diện tích trống', description: 'Tính toán không gian trống trên sàn kho để xếp hàng mới' }
  ],
  wh_counting: [
    { id: 'w_cn1', name: 'Đếm số chuyến bốc dỡ', description: 'Đếm số lượt xe nâng gắp hàng từ xe tải vào kho' },
    { id: 'w_cn2', name: 'Đếm số kiện xuất đi', description: 'Tự động đếm số thùng hàng được đẩy lên container' }
  ],
  wh_truck: [
    { id: 'w_tr1', name: 'Quản lý xe tải ra vào', description: 'Đọc biển số và theo dõi thời gian xe tải dừng tại trạm cân' },
    { id: 'w_tr2', name: 'Hướng dẫn đỗ xe tải', description: 'Phát hiện Dock bốc dỡ trống để điều phối xe tải tiến vào' }
  ],
  wh_wrongitem: [
    { id: 'w_wi1', name: 'Phân loại nhầm hàng', description: 'Phát hiện thùng hàng khác màu/kích thước bị lẫn vào dây chuyền' },
    { id: 'w_wi2', name: 'Hàng rớt khỏi băng chuyền', description: 'Cảnh báo khi có kiện hàng bị rơi rớt xuống gầm băng chuyền' }
  ],
  bld_door_abnormal: [
    { id: 'b_da1', name: 'Cửa sảnh mở lâu', description: 'Cảnh báo khi cửa kính sảnh chính bị kẹp mở không đóng lại' },
    { id: 'b_da2', name: 'Cậy phá cửa', description: 'Phát hiện hành vi tác động vật lý mạnh vào cửa kính sảnh' }
  ],
  bld_elevator_queue: [
    { id: 'b_eq1', name: 'Ùn tắc sảnh thang máy', description: 'Báo động khi có quá nhiều người xếp hàng chờ thang máy giờ cao điểm' },
    { id: 'b_eq2', name: 'Hành vi chen lấn thang', description: 'Phát hiện tình trạng xô đẩy, chen lấn khi chờ thang máy' }
  ],
  bld_meeting_room: [
    { id: 'b_mr1', name: 'Phòng họp có người', description: 'Phát hiện phòng họp đang được sử dụng dù chưa đặt lịch' },
    { id: 'b_mr2', name: 'Đếm người trong phòng họp', description: 'Đếm số người tham gia cuộc họp để điều chỉnh điều hòa' }
  ],
  bld_smoking: [
    { id: 'b_sm1', name: 'Hút thuốc hành lang', description: 'Cảnh báo khi có người hút thuốc tại hành lang chung' },
    { id: 'b_sm2', name: 'Hút thuốc cầu thang bộ', description: 'Phát hiện nhân viên hút thuốc lén tại cầu thang thoát hiểm' }
  ],
  bld_reception: [
    { id: 'b_rc1', name: 'Khách chờ tại lễ tân', description: 'Báo hiệu cho nhân viên lễ tân khi có khách đứng chờ quá 1 phút' },
    { id: 'b_rc2', name: 'Khách không hẹn trước', description: 'Nhận diện và báo cáo khách lạ đi lại khu vực sảnh lễ tân' }
  ],
  hc_ppe_sterile: [
    { id: 'h_ps1', name: 'Thiếu đồ bảo hộ phẫu thuật', description: 'Cảnh báo bác sĩ không đội mũ, đeo khẩu trang trước khi vào phòng mổ' },
    { id: 'h_ps2', name: 'Thiếu găng tay', description: 'Phát hiện nhân viên y tế không đeo găng tay khi xử lý mẫu vật' }
  ],
  hc_queue: [
    { id: 'h_qu1', name: 'Chờ lấy số thứ tự', description: 'Cảnh báo khu vực máy lấy số đang có quá đông bệnh nhân xếp hàng' },
    { id: 'h_qu2', name: 'Ùn tắc trước cửa khám', description: 'Phát hiện lượng người chờ khám tại phòng nội tổng hợp quá đông' }
  ],
  hc_hand_hygiene: [
    { id: 'h_hh1', name: 'Không sát khuẩn tay', description: 'Cảnh báo nhân viên y tế không sát khuẩn tay trước khi vào buồng bệnh' },
    { id: 'h_hh2', name: 'Tuân thủ rửa tay', description: 'Theo dõi tỷ lệ người nhà bệnh nhân rửa tay sát khuẩn tại sảnh' }
  ],
  hc_ppe_medical: [
    { id: 'h_pm1', name: 'Không khẩu trang sảnh', description: 'Cảnh báo khách ra vào bệnh viện không đeo khẩu trang y tế' },
    { id: 'h_pm2', name: 'Đeo khẩu trang sai cách', description: 'Phát hiện người kéo khẩu trang xuống cằm tại khu vực cách ly' }
  ],
  edu_leave: [
    { id: 'e_lv1', name: 'Học sinh trốn học', description: 'Phát hiện học sinh leo rào hoặc trốn khỏi khuôn viên trường' },
    { id: 'e_lv2', name: 'Ra cổng giờ học', description: 'Cảnh báo học sinh di chuyển ra hướng cổng chính khi đang có tiết' }
  ],
  edu_violence: [
    { id: 'e_vl1', name: 'Bạo lực học đường', description: 'Phát hiện đám đông học sinh tụ tập và có xô xát ở góc sân trường' },
    { id: 'e_vl2', name: 'Đánh nhau trong lớp', description: 'Cảnh báo hành vi ẩu đả giữa các học sinh khi giáo viên vắng mặt' }
  ],
  edu_attendance: [
    { id: 'e_at1', name: 'Điểm danh tự động', description: 'Nhận diện và ghi nhận sĩ số học sinh vào lớp học' },
    { id: 'e_at2', name: 'Đi trễ', description: 'Xác định học sinh đi vào lớp sau khi tiếng chuông đã reo' }
  ],
  edu_traffic: [
    { id: 'e_tr1', name: 'Đậu xe chiếm lề đường', description: 'Cảnh báo phụ huynh đỗ xe máy sai quy định trước cổng trường' },
    { id: 'e_tr2', name: 'Ùn tắc giờ tan tầm', description: 'Phát hiện tình trạng ùn tắc giao thông cục bộ khi học sinh ra về' }
  ],
`;

content = content.replace(/(const TASK_SMART_SUGGESTIONS: Record<string, Array<{ id: string; name: string; description: string }>> = {)/, `$1\n${newSuggestions}`);
fs.writeFileSync('src/components/PipelineBuilder.tsx', content, 'utf8');
