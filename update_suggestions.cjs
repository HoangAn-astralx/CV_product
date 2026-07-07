const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const newSuggestions = `
  tra_alpr: [
    { id: 't_alpr1', name: 'Đọc biển số cổng chính', description: 'Nhận diện tự động biển số các phương tiện ra vào cổng chính' },
    { id: 't_alpr2', name: 'Cảnh báo biển số đen', description: 'Cảnh báo khi phát hiện xe nằm trong danh sách đen tiến vào' },
    { id: 't_alpr3', name: 'Biển số ngoại tỉnh', description: 'Phát hiện và thống kê các xe có biển số ngoài tỉnh đi qua trạm' },
    { id: 't_alpr4', name: 'Tìm xe theo biển số', description: 'Tìm kiếm nhanh biển số xe tải khả nghi trong bãi đỗ' }
  ],
  tra_count: [
    { id: 't_cnt1', name: 'Đếm xe qua vạch', description: 'Đếm số lượng ô tô và xe máy đi qua vạch đếm' },
    { id: 't_cnt2', name: 'Thống kê lượng xe tải', description: 'Đếm và thống kê số chuyến xe tải chở hàng ra vào' },
    { id: 't_cnt3', name: 'Đếm xe máy giờ cao điểm', description: 'Thống kê lưu lượng xe máy đi qua ngã tư vào giờ tan tầm' },
    { id: 't_cnt4', name: 'Đếm xe vào bãi', description: 'Đếm tự động số lượng ô tô đi vào bãi gửi xe dưới hầm' }
  ],
  tra_parking: [
    { id: 't_pk1', name: 'Dừng đỗ trái phép', description: 'Cảnh báo xe ô tô dừng đỗ tại khu vực cấm đỗ trước sảnh' },
    { id: 't_pk2', name: 'Đỗ xe quá giờ', description: 'Phát hiện xe đỗ tại khu vực bốc dỡ hàng quá 15 phút' },
    { id: 't_pk3', name: 'Đỗ chiếm làn đường', description: 'Cảnh báo xe tải đỗ chiếm vạch kẻ đường dành cho người đi bộ' },
    { id: 't_pk4', name: 'Đỗ sai vị trí VIP', description: 'Phát hiện xe lạ đỗ vào khu vực dành riêng cho khách hàng VIP' }
  ],
  tra_speed: [
    { id: 't_sp1', name: 'Chạy quá tốc độ', description: 'Cảnh báo xe chạy vượt quá 40km/h trong khu dân cư' },
    { id: 't_sp2', name: 'Xe máy phóng nhanh', description: 'Phát hiện xe máy chạy tốc độ cao tại khu vực giao lộ' },
    { id: 't_sp3', name: 'Xe tải đi quá nhanh', description: 'Cảnh báo xe tải chạy quá 30km/h trong khuôn viên nhà máy' },
    { id: 't_sp4', name: 'Giám sát tốc độ tối thiểu', description: 'Phát hiện xe di chuyển chậm bất thường trên cao tốc' }
  ],
  prd_label: [
    { id: 'p_lb1', name: 'Kiểm tra dán nhãn', description: 'Phát hiện sản phẩm bị dán nhãn lệch hoặc rách bao bì' },
    { id: 'p_lb2', name: 'Đọc mã vạch/OCR', description: 'Đọc văn bản và mã vạch trên nhãn để xác nhận thông tin' },
    { id: 'p_lb3', name: 'Nhãn in mờ', description: 'Cảnh báo khi chữ in trên tem nhãn của sản phẩm bị mờ, không rõ' },
    { id: 'p_lb4', name: 'Dán sai tem', description: 'Phát hiện thùng hàng bị dán sai loại tem so với quy định' }
  ],
  prd_assembly: [
    { id: 'p_as1', name: 'Kiểm tra linh kiện', description: 'Cảnh báo bảng mạch thiếu linh kiện hoặc lắp ráp sai vị trí' },
    { id: 'p_as2', name: 'Sai sót công đoạn', description: 'Phát hiện công nhân bỏ qua bước siết ốc trên dây chuyền' },
    { id: 'p_as3', name: 'Phát hiện vết nứt', description: 'Phát hiện các vết nứt nhỏ trên bề mặt vỏ nhựa của sản phẩm' },
    { id: 'p_as4', name: 'Lắp ngược chiều', description: 'Cảnh báo khi bộ phận nắp chai bị lắp ngược hoặc bị kênh' }
  ],
  prd_counting: [
    { id: 'p_cn1', name: 'Đếm thùng hàng', description: 'Đếm số lượng thùng carton chạy qua băng chuyền' },
    { id: 'p_cn2', name: 'Đếm sản phẩm đóng gói', description: 'Đếm chính xác số chai/lọ thành phẩm trước khi đóng thùng' },
    { id: 'p_cn3', name: 'Kiểm đếm bao tải', description: 'Đếm tự động số lượng bao phân bón xuất khỏi dây chuyền' },
    { id: 'p_cn4', name: 'Đếm linh kiện lỗi', description: 'Đếm và thống kê số linh kiện bị loại ra khỏi băng chuyền' }
  ],
  prd_productivity: [
    { id: 'p_pd1', name: 'Đo lường thời gian trễ', description: 'Tính toán thời gian băng chuyền dừng hoạt động' },
    { id: 'p_pd2', name: 'Phân tích nhịp độ', description: 'Theo dõi tốc độ làm việc trung bình của công nhân tại trạm' },
    { id: 'p_pd3', name: 'Phát hiện máy dừng', description: 'Cảnh báo ngay khi máy ép nhựa ngừng hoạt động quá 2 phút' },
    { id: 'p_pd4', name: 'Tính số sản phẩm/giờ', description: 'Đo lường tự động số lượng sản phẩm hoàn thành mỗi giờ' }
  ],
  hse_ppe: [
    { id: 'h_pp1', name: 'Thiếu mũ bảo hộ', description: 'Cảnh báo công nhân không đội mũ bảo hộ tại công trường' },
    { id: 'h_pp2', name: 'Không mặc áo phản quang', description: 'Phát hiện người không mặc áo phản quang vào khu vực máy xúc' },
    { id: 'h_pp3', name: 'Không mang giày bảo hộ', description: 'Phát hiện công nhân đi dép lê hoặc không mang giày an toàn' },
    { id: 'h_pp4', name: 'Thiếu kính hàn', description: 'Cảnh báo thợ hàn không đeo kính bảo hộ khi làm việc' }
  ],
  hse_machine: [
    { id: 'h_mc1', name: 'Đứng gần máy ép', description: 'Cảnh báo khi người lao động đứng quá gần khu vực dập cắt' },
    { id: 'h_mc2', name: 'Vượt rào chắn an toàn', description: 'Phát hiện nhân viên bước qua vạch vàng cảnh báo an toàn' },
    { id: 'h_mc3', name: 'Thò tay vào máy', description: 'Cảnh báo khẩn cấp khi tay công nhân tiến sát lưỡi cưa' },
    { id: 'h_mc4', name: 'Chui vào gầm máy', description: 'Phát hiện hành vi nguy hiểm chui vào gầm dây chuyền đang chạy' }
  ],
  hse_fight: [
    { id: 'h_fg1', name: 'Đánh nhau tại xưởng', description: 'Phát hiện hành vi ẩu đả, xô xát giữa các công nhân' },
    { id: 'h_fg2', name: 'Bạo lực tại cổng', description: 'Cảnh báo xô xát xảy ra khu vực kiểm soát ra vào' },
    { id: 'h_fg3', name: 'Đám đông căng thẳng', description: 'Phát hiện đám đông có dấu hiệu kích động, chỉ trỏ lớn tiếng' },
    { id: 'h_fg4', name: 'Người ngã do xô đẩy', description: 'Phát hiện người bị ngã xuống đất sau tình huống giằng co' }
  ],
  hse_phone: [
    { id: 'h_ph1', name: 'Dùng điện thoại khi lái xe', description: 'Phát hiện tài xế xe nâng đang sử dụng điện thoại' },
    { id: 'h_ph2', name: 'Dùng điện thoại tại chuyền', description: 'Cảnh báo công nhân bấm điện thoại trong giờ làm việc' },
    { id: 'h_ph3', name: 'Cầm điện thoại khu vực cấm', description: 'Phát hiện nhân viên rút điện thoại ra tại kho chứa hóa chất dễ cháy' },
    { id: 'h_ph4', name: 'Vừa đi vừa bấm điện thoại', description: 'Cảnh báo người vừa đi bộ vừa nhìn màn hình điện thoại tại lối đi xe nâng' }
  ],
  hse_proximity: [
    { id: 'h_pr1', name: 'Người lại gần xe nâng', description: 'Báo động khi có người đi bộ đến gần xe nâng đang hoạt động' },
    { id: 'h_pr2', name: 'Xung đột giao thông xưởng', description: 'Cảnh báo xe điện và người đi bộ sắp va chạm tại ngã tư xưởng' },
    { id: 'h_pr3', name: 'Lại gần cần cẩu', description: 'Cảnh báo khi công nhân bước vào bán kính hoạt động của cần cẩu' },
    { id: 'h_pr4', name: 'Đứng sau đuôi xe tải', description: 'Phát hiện người đứng trong điểm mù phía sau xe tải đang lùi' }
  ],
  fir_fire: [
    { id: 'f_fi1', name: 'Phát hiện khói', description: 'Cảnh báo sớm khi có khói đen bốc lên từ khu vực kho bãi' },
    { id: 'f_fi2', name: 'Phát hiện ngọn lửa', description: 'Phát hiện ngọn lửa bùng phát tại khu vực chứa hóa chất' },
    { id: 'f_fi3', name: 'Khói mù hành lang', description: 'Cảnh báo khói dày đặc che khuất camera tại hành lang thoát hiểm' },
    { id: 'f_fi4', name: 'Tia lửa điện', description: 'Phát hiện các tia lửa tóe ra bất thường từ tủ điện' }
  ],
  fir_smoking: [
    { id: 'f_sm1', name: 'Hút thuốc trong xưởng', description: 'Cảnh báo nhân viên hút thuốc tại khu vực cấm lửa' },
    { id: 'f_sm2', name: 'Hút thuốc kho chứa', description: 'Phát hiện người cầm điếu thuốc đang cháy ở kho bao bì' },
    { id: 'f_sm3', name: 'Nhả khói thuốc lá', description: 'Nhận diện luồng khói nhả ra từ miệng người tại trạm xăng' },
    { id: 'f_sm4', name: 'Hút thuốc góc khuất', description: 'Cảnh báo người trốn ra góc chân cầu thang bộ để hút thuốc' }
  ],
  fir_exit: [
    { id: 'f_ex1', name: 'Vật cản lối thoát hiểm', description: 'Cảnh báo khi có thùng hàng đặt chắn ngang lối thoát hiểm' },
    { id: 'f_ex2', name: 'Cửa thoát hiểm bị khóa', description: 'Phát hiện hành vi khóa hoặc chốt chặt cửa thoát hiểm khẩn cấp' },
    { id: 'f_ex3', name: 'Để xe trước lối thoát', description: 'Cảnh báo ô tô hoặc xe máy đỗ bít lối ra vào thoát hiểm' },
    { id: 'f_ex4', name: 'Tập kết rác lối thoát', description: 'Phát hiện các túi rác hoặc phế liệu bị chất đống trước cửa thoát hiểm' }
  ],
  ret_counting: [
    { id: 'r_cn1', name: 'Đếm khách vào ra', description: 'Thống kê lượng khách hàng đi qua cửa chính cửa hàng' },
    { id: 'r_cn2', name: 'Khách hàng lên tầng', description: 'Đếm số lượng khách sử dụng thang cuốn để lên tầng 2' },
    { id: 'r_cn3', name: 'Khách vào khu dùng thử', description: 'Đếm số khách đi vào khu vực trải nghiệm sản phẩm mới' },
    { id: 'r_cn4', name: 'Đếm theo nhóm', description: 'Phát hiện và đếm khách đi vào theo nhóm gia đình hoặc cá nhân' }
  ],
  ret_heatmap: [
    { id: 'r_hm1', name: 'Bản đồ nhiệt quầy', description: 'Phân tích vùng khách hàng tập trung đông nhất tại quầy mỹ phẩm' },
    { id: 'r_hm2', name: 'Điểm nóng lối đi', description: 'Xác định các kệ hàng thu hút nhiều người dừng lại xem nhất' },
    { id: 'r_hm3', name: 'Thời gian dừng chân', description: 'Đo lường khu vực khách hàng thường xuyên đứng lại lâu nhất' },
    { id: 'r_hm4', name: 'Góc khuất ít người', description: 'Báo cáo các góc chết trong cửa hàng mà khách hiếm khi bước vào' }
  ],
  ret_shelf: [
    { id: 'r_sh1', name: 'Kệ hàng trống', description: 'Cảnh báo nhân viên khi kệ trưng bày nước giải khát hết hàng' },
    { id: 'r_sh2', name: 'Hàng hóa lộn xộn', description: 'Phát hiện tình trạng hàng hóa bị đổ gãy, sai vị trí trên kệ' },
    { id: 'r_sh3', name: 'Thiếu sản phẩm khuyến mãi', description: 'Cảnh báo khu vực trưng bày sản phẩm hot bị trống chỗ' },
    { id: 'r_sh4', name: 'Hàng rơi xuống sàn', description: 'Phát hiện hộp sản phẩm bị rớt từ trên kệ xuống lối đi' }
  ],
  ret_queue: [
    { id: 'r_qu1', name: 'Hàng đợi thanh toán', description: 'Cảnh báo khi có hơn 5 khách hàng đang xếp hàng chờ thanh toán' },
    { id: 'r_qu2', name: 'Chờ tại quầy dịch vụ', description: 'Phát hiện khách hàng đứng chờ quá lâu tại quầy tư vấn' },
    { id: 'r_qu3', name: 'Mở thêm quầy', description: 'Cảnh báo gọi thu ngân mở thêm quầy khi hàng đợi dài quá 4 mét' },
    { id: 'r_qu4', name: 'Khách hàng bỏ đi', description: 'Phát hiện khách hàng rời khỏi hàng đợi do chờ quá lâu' }
  ],
  ret_crowdanalysis: [
    { id: 'r_ca1', name: 'Nhân khẩu học khách', description: 'Thống kê tỷ lệ nam/nữ và độ tuổi ước lượng của khách mua sắm' },
    { id: 'r_ca2', name: 'Nhận diện khách VIP', description: 'Nhận diện nhanh chóng khách hàng VIP khi bước vào cửa hàng' },
    { id: 'r_ca3', name: 'Phát hiện trẻ em đi lạc', description: 'Phát hiện trẻ em đứng khóc một mình không có người lớn đi kèm' },
    { id: 'r_ca4', name: 'Đám đông sự kiện', description: 'Đo lường số lượng khách vây quanh khu vực tổ chức sự kiện' }
  ],
  ret_staff_absence: [
    { id: 'r_sa1', name: 'Vắng mặt tại quầy', description: 'Cảnh báo khi quầy thu ngân không có nhân viên trực quá 3 phút' },
    { id: 'r_sa2', name: 'Nhân viên lơ là', description: 'Phát hiện nhân viên không đứng đúng vị trí phân công' },
    { id: 'r_sa3', name: 'Thiếu người tiếp khách', description: 'Cảnh báo khách vào cửa hàng mà không có nhân viên ra tiếp đón' },
    { id: 'r_sa4', name: 'Nhân viên tụ tập', description: 'Phát hiện 3 nhân viên trở lên đứng túm tụm nói chuyện riêng' }
  ],
  wh_forklift: [
    { id: 'w_fl1', name: 'Xe nâng chạy quá tốc độ', description: 'Cảnh báo xe nâng di chuyển quá tốc độ trong kho hẹp' },
    { id: 'w_fl2', name: 'Xe nâng sai tuyến', description: 'Phát hiện xe nâng đi vào khu vực dành riêng cho người đi bộ' },
    { id: 'w_fl3', name: 'Đỗ xe nâng cản trở', description: 'Cảnh báo xe nâng đỗ chình ình giữa ngã ba lối đi trong kho' },
    { id: 'w_fl4', name: 'Lùi xe nguy hiểm', description: 'Phát hiện xe nâng lùi mà không có người xi-nhan tại khu vực khuất' }
  ],
  wh_wrongzone: [
    { id: 'w_wz1', name: 'Để kiện hàng sai bãi', description: 'Phát hiện pallet xếp nhầm vào khu vực xuất hàng đi quốc tế' },
    { id: 'w_wz2', name: 'Đỗ xe sai làn bốc dỡ', description: 'Cảnh báo xe tải đỗ vào bãi xuất hàng khi chưa đến lượt' },
    { id: 'w_wz3', name: 'Xếp hàng vượt vạch', description: 'Phát hiện các thùng hàng bị xếp lấn ra ngoài vạch kẻ lối đi' },
    { id: 'w_wz4', name: 'Để rác nhầm chỗ', description: 'Phát hiện thùng rác hoặc vật phế liệu để vào bãi tập kết hàng mới' }
  ],
  wh_inventory: [
    { id: 'w_iv1', name: 'Kiểm kê pallet tự động', description: 'Quét và đếm số lượng pallet đang tồn tại trên kệ kệ Rack' },
    { id: 'w_iv2', name: 'Thống kê diện tích trống', description: 'Tính toán không gian trống trên sàn kho để xếp hàng mới' },
    { id: 'w_iv3', name: 'Phát hiện kệ trống', description: 'Cảnh báo các ô kệ Rack đã hết hàng để dọn chỗ lưu kho' },
    { id: 'w_iv4', name: 'Kiểm tra xếp chồng', description: 'Phát hiện thùng hàng bị xếp chồng quá cao nguy cơ đổ vỡ' }
  ],
  wh_counting: [
    { id: 'w_cn1', name: 'Đếm số chuyến bốc dỡ', description: 'Đếm số lượt xe nâng gắp hàng từ xe tải vào kho' },
    { id: 'w_cn2', name: 'Đếm số kiện xuất đi', description: 'Tự động đếm số thùng hàng được đẩy lên container' },
    { id: 'w_cn3', name: 'Đếm bao bì', description: 'Đếm số lượng bao tải xi măng được chuyển qua băng tải' },
    { id: 'w_cn4', name: 'Thống kê hàng nhập', description: 'Đếm số lượng pallet được dỡ xuống từ xe container' }
  ],
  wh_truck: [
    { id: 'w_tr1', name: 'Quản lý xe tải ra vào', description: 'Đọc biển số và theo dõi thời gian xe tải dừng tại trạm cân' },
    { id: 'w_tr2', name: 'Hướng dẫn đỗ xe tải', description: 'Phát hiện Dock bốc dỡ trống để điều phối xe tải tiến vào' },
    { id: 'w_tr3', name: 'Xe tải đỗ quá lâu', description: 'Cảnh báo xe tải chiếm dụng cửa bốc dỡ quá 2 giờ đồng hồ' },
    { id: 'w_tr4', name: 'Lùi xe sai cửa', description: 'Phát hiện xe tải lùi nhầm vào cửa Dock đang sửa chữa' }
  ],
  wh_wrongitem: [
    { id: 'w_wi1', name: 'Phân loại nhầm hàng', description: 'Phát hiện thùng hàng khác màu/kích thước bị lẫn vào dây chuyền' },
    { id: 'w_wi2', name: 'Hàng rớt khỏi băng chuyền', description: 'Cảnh báo khi có kiện hàng bị rơi rớt xuống gầm băng chuyền' },
    { id: 'w_wi3', name: 'Thùng hàng rách nát', description: 'Phát hiện hộp carton bị móp méo, rách vỡ trên băng tải xuất' },
    { id: 'w_wi4', name: 'Lẫn dị vật', description: 'Cảnh báo khi có dị vật (như cờ lê, giẻ lau) nằm trên băng chuyền' }
  ],
  bld_door_abnormal: [
    { id: 'b_da1', name: 'Cửa sảnh mở lâu', description: 'Cảnh báo khi cửa kính sảnh chính bị kẹp mở không đóng lại' },
    { id: 'b_da2', name: 'Cậy phá cửa', description: 'Phát hiện hành vi tác động vật lý mạnh vào cửa kính sảnh' },
    { id: 'b_da3', name: 'Mở cửa ngoài giờ', description: 'Cảnh báo nếu cửa phòng giám đốc bị mở sau 20:00' },
    { id: 'b_da4', name: 'Chặn cửa bằng vật cứng', description: 'Phát hiện có ghế hoặc gạch được dùng để chèn không cho cửa đóng' }
  ],
  bld_elevator_queue: [
    { id: 'b_eq1', name: 'Ùn tắc sảnh thang máy', description: 'Báo động khi có quá nhiều người xếp hàng chờ thang máy giờ cao điểm' },
    { id: 'b_eq2', name: 'Hành vi chen lấn thang', description: 'Phát hiện tình trạng xô đẩy, chen lấn khi chờ thang máy' },
    { id: 'b_eq3', name: 'Giữ cửa thang máy lâu', description: 'Cảnh báo khi có người cố tình đứng chặn giữ cửa thang máy quá lâu' },
    { id: 'b_eq4', name: 'Đem hàng cồng kềnh', description: 'Phát hiện người chở xe đẩy hàng cồng kềnh vào thang máy hành khách' }
  ],
  bld_meeting_room: [
    { id: 'b_mr1', name: 'Phòng họp có người', description: 'Phát hiện phòng họp đang được sử dụng dù chưa đặt lịch' },
    { id: 'b_mr2', name: 'Đếm người trong phòng họp', description: 'Đếm số người tham gia cuộc họp để điều chỉnh điều hòa' },
    { id: 'b_mr3', name: 'Quên tắt điện/thiết bị', description: 'Cảnh báo phòng họp không có người nhưng máy chiếu vẫn bật' },
    { id: 'b_mr4', name: 'Họp quá giờ', description: 'Cảnh báo cuộc họp kéo dài lấn sang lịch đặt phòng của người khác' }
  ],
  bld_smoking: [
    { id: 'b_sm1', name: 'Hút thuốc hành lang', description: 'Cảnh báo khi có người hút thuốc tại hành lang chung' },
    { id: 'b_sm2', name: 'Hút thuốc cầu thang bộ', description: 'Phát hiện nhân viên hút thuốc lén tại cầu thang thoát hiểm' },
    { id: 'b_sm3', name: 'Hút thuốc nhà vệ sinh', description: 'Phát hiện khói nhả ra từ cửa khu vực nhà vệ sinh' },
    { id: 'b_sm4', name: 'Hút thuốc hầm để xe', description: 'Cảnh báo người cầm điếu thuốc tại khu vực hầm đỗ xe dễ cháy' }
  ],
  bld_reception: [
    { id: 'b_rc1', name: 'Khách chờ tại lễ tân', description: 'Báo hiệu cho nhân viên lễ tân khi có khách đứng chờ quá 1 phút' },
    { id: 'b_rc2', name: 'Khách không hẹn trước', description: 'Nhận diện và báo cáo khách lạ đi lại khu vực sảnh lễ tân' },
    { id: 'b_rc3', name: 'Tụ tập quầy lễ tân', description: 'Cảnh báo khi có quá đông khách (trên 10 người) vây quanh quầy' },
    { id: 'b_rc4', name: 'Shipper giao đồ', description: 'Phát hiện nhân viên giao hàng mặc đồng phục (Grab, Shopee) đang chờ' }
  ],
  hc_ppe_sterile: [
    { id: 'h_ps1', name: 'Thiếu đồ bảo hộ phẫu thuật', description: 'Cảnh báo bác sĩ không đội mũ, đeo khẩu trang trước khi vào phòng mổ' },
    { id: 'h_ps2', name: 'Thiếu găng tay', description: 'Phát hiện nhân viên y tế không đeo găng tay khi xử lý mẫu vật' },
    { id: 'h_ps3', name: 'Không mặc áo choàng', description: 'Phát hiện người không mặc áo choàng cách ly đi vào buồng bệnh đặc biệt' },
    { id: 'h_ps4', name: 'Mặc sai quy cách PPE', description: 'Cảnh báo đồ bảo hộ bị rách hoặc mặc không kín sát' }
  ],
  hc_queue: [
    { id: 'h_qu1', name: 'Chờ lấy số thứ tự', description: 'Cảnh báo khu vực máy lấy số đang có quá đông bệnh nhân xếp hàng' },
    { id: 'h_qu2', name: 'Ùn tắc trước cửa khám', description: 'Phát hiện lượng người chờ khám tại phòng nội tổng hợp quá đông' },
    { id: 'h_qu3', name: 'Hàng chờ cấp cứu', description: 'Báo động khi có bệnh nhân phải chờ ở hành lang khu vực cấp cứu' },
    { id: 'h_qu4', name: 'Chờ thanh toán viện phí', description: 'Đếm số lượng người xếp hàng nộp tiền viện phí giờ cao điểm' }
  ],
  hc_hand_hygiene: [
    { id: 'h_hh1', name: 'Không sát khuẩn tay', description: 'Cảnh báo nhân viên y tế không sát khuẩn tay trước khi vào buồng bệnh' },
    { id: 'h_hh2', name: 'Tuân thủ rửa tay', description: 'Theo dõi tỷ lệ người nhà bệnh nhân rửa tay sát khuẩn tại sảnh' },
    { id: 'h_hh3', name: 'Không rửa tay sau khám', description: 'Cảnh báo bác sĩ không sát khuẩn lại tay sau khi rời khỏi phòng khám' },
    { id: 'h_hh4', name: 'Sát khuẩn quá nhanh', description: 'Phát hiện hành vi rửa tay chiếu lệ dưới 5 giây' }
  ],
  hc_ppe_medical: [
    { id: 'h_pm1', name: 'Không khẩu trang sảnh', description: 'Cảnh báo khách ra vào bệnh viện không đeo khẩu trang y tế' },
    { id: 'h_pm2', name: 'Đeo khẩu trang sai cách', description: 'Phát hiện người kéo khẩu trang xuống cằm tại khu vực cách ly' },
    { id: 'h_pm3', name: 'Bỏ khẩu trang khi ho', description: 'Phát hiện bệnh nhân tháo khẩu trang ra để ho/hắt hơi' },
    { id: 'h_pm4', name: 'Nhân viên không khẩu trang', description: 'Cảnh báo y tá/bác sĩ không đeo khẩu trang khi giao tiếp bệnh nhân' }
  ],
  edu_leave: [
    { id: 'e_lv1', name: 'Học sinh trốn học', description: 'Phát hiện học sinh leo rào hoặc trốn khỏi khuôn viên trường' },
    { id: 'e_lv2', name: 'Ra cổng giờ học', description: 'Cảnh báo học sinh di chuyển ra hướng cổng chính khi đang có tiết' },
    { id: 'e_lv3', name: 'Trốn ở góc khuất', description: 'Phát hiện học sinh núp sau nhà vệ sinh hoặc gốc cây trong giờ học' },
    { id: 'e_lv4', name: 'Trèo tường rào', description: 'Báo động khi có người trèo qua tường rào bảo vệ của trường học' }
  ],
  edu_violence: [
    { id: 'e_vl1', name: 'Bạo lực học đường', description: 'Phát hiện đám đông học sinh tụ tập và có xô xát ở góc sân trường' },
    { id: 'e_vl2', name: 'Đánh nhau trong lớp', description: 'Cảnh báo hành vi ẩu đả giữa các học sinh khi giáo viên vắng mặt' },
    { id: 'e_vl3', name: 'Đe dọa/Trấn lột', description: 'Phát hiện một nhóm học sinh bao vây dồn ép một học sinh khác' },
    { id: 'e_vl4', name: 'Vũ khí trong trường', description: 'Cảnh báo khẩn cấp khi phát hiện học sinh cầm gậy gộc hoặc vật sắc nhọn' }
  ],
  edu_attendance: [
    { id: 'e_at1', name: 'Điểm danh tự động', description: 'Nhận diện và ghi nhận sĩ số học sinh vào lớp học' },
    { id: 'e_at2', name: 'Đi trễ', description: 'Xác định học sinh đi vào lớp sau khi tiếng chuông đã reo' },
    { id: 'e_at3', name: 'Rời lớp sớm', description: 'Ghi nhận học sinh xách cặp đi ra khỏi lớp trước giờ tan trường' },
    { id: 'e_at4', name: 'Vắng mặt quá lâu', description: 'Cảnh báo khi học sinh xin ra ngoài đi vệ sinh quá 15 phút chưa quay lại' }
  ],
  edu_traffic: [
    { id: 'e_tr1', name: 'Đậu xe chiếm lề đường', description: 'Cảnh báo phụ huynh đỗ xe máy sai quy định trước cổng trường' },
    { id: 'e_tr2', name: 'Ùn tắc giờ tan tầm', description: 'Phát hiện tình trạng ùn tắc giao thông cục bộ khi học sinh ra về' },
    { id: 'e_tr3', name: 'Bán hàng rong cản lối', description: 'Cảnh báo xe đẩy bán hàng rong lấn chiếm vạch sang đường của học sinh' },
    { id: 'e_tr4', name: 'Xe ô tô quay đầu hẹp', description: 'Phát hiện ô tô quay đầu gây ách tắc ngay trước cổng trường học' }
  ],
`;

content = content.replace(/tra_alpr: \[\s*\{[\s\S]*?edu_traffic: \[\s*\{[\s\S]*?\n  \],/, newSuggestions);
fs.writeFileSync('src/components/PipelineBuilder.tsx', content, 'utf8');
