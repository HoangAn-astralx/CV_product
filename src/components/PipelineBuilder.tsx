import React, { useState, useRef, Dispatch, SetStateAction } from 'react';
import { Camera, Pipeline, CountingZone, AlertRule, ScheduleSlot } from '../types';
import { PIPELINE_TEMPLATES } from '../mockData';
import {
  Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft,
  MessageSquare, Send, Mail, Webhook, FileText, Clock, ChevronRight, Trash2, Pencil,
  X, LayoutGrid, Shield, BarChart3, HardHat, Flame, Car, Package, Tag, Bug, Search,
  Activity, Store, Sparkles, Plus, Copy, Zap, Wifi, Monitor, Usb, Building2, Stethoscope, GraduationCap, Plane
} from 'lucide-react';
import ImageRoiDrawer, { BoundingBox } from './ImageRoiDrawer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DrawnZone {
  id: string;
  name: string;
  type: 'line' | 'zone';
  role?: 'monitor' | 'exclude'; // 'monitor' = AI watches here; 'exclude' = allowed/exception zone
  points: { x: number; y: number }[];
}

interface PipelineBuilderProps {
  cameras: Camera[];
  pipelines: Pipeline[];
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>;
  setRules?: Dispatch<SetStateAction<AlertRule[]>>;
  onComplete: () => void;
  onSelectCamera?: (id: string) => void;
}

type InferredMonitoringConfig = {
  mode: 'standard' | 'smart' | 'defect_detection';
  model: string;
  target?: string;
  rule: string;
  scope: 'whole_scene' | 'roi';
  countingType: 'zone' | 'line';
  searchQuery?: string;
  config: Record<string, string | number | boolean | undefined>;
};

type Step = 'list' | 'camera' | 'task' | 'config' | 'alert' | 'preview';
const WIZARD_STEPS: Step[] = ['camera', 'task', 'config', 'alert', 'preview'];

const ZONE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const ZONE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ALL_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatScheduleSlots(slots: ScheduleSlot[]): string {
  if (!slots || slots.length === 0) return '24/7 liên tục';
  if (slots.length === 1) {
    const s = slots[0];
    const isAllDays = ALL_DAYS.every(d => s.days.includes(d));
    const dayStr = isAllDays ? 'Hàng ngày' : s.days.join(', ');
    return `${dayStr} · ${s.start}–${s.end}`;
  }
  return slots.map(s => `${s.days.join(',')} ${s.start}–${s.end}`).join(' | ');
}

// Per-task quick suggestions for Smart AI mode
const TASK_SMART_SUGGESTIONS: Record<string, Array<{ id: string; name: string; description: string }>> = {

  
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
    { id: 'p_lb3', name: 'Thiếu nhãn sản phẩm', description: 'Phát hiện sản phẩm trên dây chuyền không có nhãn hoặc tem bị bong/thiếu hoàn toàn' },
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
  hse_fall: [
    { id: 'h_fl1', name: 'Người già ngã bất ngờ', description: 'Phát hiện người cao tuổi ngã xuống sàn và không cử động' },
    { id: 'h_fl2', name: 'Công nhân bất tỉnh tại xưởng', description: 'Cảnh báo khi công nhân đột ngột ngã và nằm yên trên sàn' },
    { id: 'h_fl3', name: 'Bệnh nhân rời giường ngã', description: 'Phát hiện bệnh nhân ngã khỏi giường hoặc bất tỉnh tại chỗ' },
    { id: 'h_fl4', name: 'Đột quỵ tại chỗ làm', description: 'Nhân viên đột ngột ngã hoặc nằm bất động tại văn phòng' },
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
    { id: 'r_sh1', name: 'Phát hiện kệ hàng trống', description: 'Cảnh báo nhân viên khi kệ trưng bày nước giải khát hết hàng' },
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
    { id: 'r_ca1', name: 'Đếm khách theo khung giờ', description: 'Thống kê số lượng khách vào cửa hàng theo từng khung giờ trong ngày' },
    { id: 'r_ca2', name: 'Phân tích khu vực nóng', description: 'Xác định khu vực trong cửa hàng có lượng khách dừng chân và tương tác cao nhất' },
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


  sec_camera_tamper: [
    { id: 'ct1', name: 'Che tay trước ống kính', description: 'Cảnh báo khi có người cố tình dùng tay che camera' },
    { id: 'ct2', name: 'Xịt sơn/Dán băng dính', description: 'Phát hiện ống kính bị xịt sơn đen hoặc dán kín' },
    { id: 'ct3', name: 'Camera bị bẻ hướng', description: 'Báo động khi camera bị tác động vật lý làm sai lệch góc nhìn ban đầu' },
  ],
  sec_door_abnormal: [
    { id: 'da1', name: 'Cửa kho mở quá lâu', description: 'Cảnh báo nếu cửa kho hàng bị mở liên tục hơn 5 phút' },
    { id: 'da2', name: 'Cửa thoát hiểm mở', description: 'Phát hiện cửa thoát hiểm tự động bị mở ra' },
    { id: 'da3', name: 'Mở cửa ngoài giờ', description: 'Cảnh báo khi cửa phòng server bị mở sau 18:00' },
  ],
  sec_wrong_way: [
    { id: 'ww1', name: 'Đi ngược chiều cổng ra', description: 'Phát hiện có người cố tình đi ngược từ ngoài vào qua cổng ra' },
    { id: 'ww2', name: 'Xe máy đi lùi', description: 'Cảnh báo xe máy đi lùi hoặc quay đầu ngược chiều' },
    { id: 'ww3', name: 'Nhầm làn đường', description: 'Cảnh báo khi xe ô tô đi vào làn dành riêng cho xe máy' },
    { id: 'ww4', name: 'Ngược chiều bãi đỗ', description: 'Phát hiện xe chạy ngược chiều mũi tên chỉ dẫn trong hầm' },
  ],
  sec_abandoned_object: [
    { id: 'ao1', name: 'Vali vô chủ', description: 'Phát hiện vali hoặc túi xách để ở sảnh quá 10 phút' },
    { id: 'ao2', name: 'Thùng hàng lạ', description: 'Cảnh báo có thùng giấy lạ xuất hiện tại lối đi không ai nhận' },
    { id: 'ao3', name: 'Túi rác sai quy định', description: 'Phát hiện các túi rác hoặc vật phế thải vứt sai nơi quy định' },
    { id: 'ao4', name: 'Vật thể cản lối thoát hiểm', description: 'Cảnh báo khi có chướng ngại vật bị bỏ lại chặn cửa thoát hiểm' },
  ],
  sec_intrusion: [
    { id: 'in1', name: 'Xâm nhập kho hàng', description: 'Cảnh báo tự động khi có người đi vào khu vực bốc xếp hàng hóa' },
    { id: 'in2', name: 'Đột nhập tường rào', description: 'Phát hiện đối tượng leo trèo hoặc xâm nhập qua tường rào bảo vệ' },
    { id: 'in3', name: 'Khu vực điện cao thế', description: 'Báo động ngay lập tức nếu có người tiến vào trạm biến áp' },
    { id: 'in4', name: 'Xâm nhập công trường', description: 'Cảnh báo người lạ đi vào khu vực đang thi công nguy hiểm' },
  ],
  sec_loitering: [
    { id: 'lo1', name: 'Lảng vảng trước cổng', description: 'Phát hiện đối tượng đứng lâu bất thường trước cổng công ty' },
    { id: 'lo2', name: 'Dừng đỗ trước cây ATM', description: 'Cảnh báo người đứng lảng vảng quá 5 phút tại khu vực máy ATM' },
    { id: 'lo3', name: 'Khách lạ dòm ngó', description: 'Phát hiện người đứng lại rất lâu trước cửa hàng hoặc quầy giao dịch' },
    { id: 'lo4', name: 'Lảng vảng khu vực kho', description: 'Báo động khi có người đứng lảng vảng quanh khu kho hàng hoặc cửa bốc dỡ quá 10 phút' },
  ],
  sec_afterhours: [
    { id: 'ah1', name: 'Nhân viên ở lại muộn', description: 'Cảnh báo khi còn người trong khu vực văn phòng sau 22:00' },
    { id: 'ah2', name: 'Đột nhập nhà xưởng đêm', description: 'Phát hiện kẻ gian lẻn vào nhà máy khi đã tắt hết đèn sản xuất' },
    { id: 'ah3', name: 'Chuyển hàng ban đêm', description: 'Báo động khi có xe tải chạy vào bãi xuất nhập hàng sau 20:00' },
    { id: 'ah4', name: 'Sử dụng thang máy đêm', description: 'Cảnh báo người sử dụng thang máy ngoài khung giờ vận hành' },
  ],
  sec_assetloss: [
    { id: 'al1', name: 'Mất laptop/thiết bị', description: 'Cảnh báo ngay lập tức nếu laptop trên bàn bị dời khỏi vị trí' },
    { id: 'al2', name: 'Tranh ảnh/Đồ cổ bị di dời', description: 'Phát hiện hiện vật trưng bày trong bảo tàng bị xê dịch' },
    { id: 'al3', name: 'Bình chữa cháy bị lấy đi', description: 'Cảnh báo khi bình chữa cháy treo tường bị gỡ xuống' },
    { id: 'al4', name: 'Mất hàng hóa có giá trị', description: 'Báo động khi các linh kiện đắt tiền trên kệ bị lấy mất' },
  ],
  sec_crowd: [
    { id: 'cr1', name: 'Biểu tình/Bạo loạn', description: 'Cảnh báo sớm khi có từ 5 người trở lên tụ tập trước cổng chính' },
    { id: 'cr2', name: 'Tụ tập lối thoát hiểm', description: 'Phát hiện đám đông cản trở khu vực hành lang và lối thoát hiểm' },
    { id: 'cr3', name: 'Chen lấn quầy giao dịch', description: 'Báo động tình trạng tụ tập hỗn loạn trước quầy phục vụ' },
    { id: 'cr4', name: 'Đám đông đánh nhau', description: 'Phát hiện một nhóm đông người tụ lại có xô xát hoặc hỗn chiến' },
  ],
  sec_vehicle_reid: [
    { id: 'vr1', name: 'Tìm xe khả nghi', description: 'Tìm kiếm chiếc xe vừa xuất hiện tại hiện trường vụ trộm' },
    { id: 'vr2', name: 'Truy vết xe gây tai nạn', description: 'Xác định hướng đi của xe bỏ trốn qua mạng lưới camera' },
    { id: 'vr3', name: 'Tìm xe VIP/Khách hàng', description: 'Tự động báo khi xe của khách hàng VIP tiến vào khuôn viên' },
    { id: 'vr4', name: 'Theo dõi xe chở hàng', description: 'Nhận diện liên tục lộ trình của xe tải chở hàng qua các trạm' },
  ],
  security: [
    { id: 's1', name: 'Xâm nhập ngoài giờ', description: 'Phát hiện người di chuyển trong văn phòng sau 22:00' },
    { id: 's2', name: 'Phát hiện đám đông / bạo loạn', description: 'Báo khi có từ 3 người trở lên đứng yên hơn 5 phút' },
    { id: 's3', name: 'Bỏ lại đồ vật', description: 'Phát hiện balo hoặc túi xách bị bỏ lại không có người' },
    { id: 's4', name: 'Xâm nhập kho hàng', description: 'Cảnh báo khi có người vào khu vực bốc xếp hàng hóa' },
    { id: 's5', name: 'Phá khóa, đập cửa', description: 'Phát hiện hành vi tác động bất thường vào cửa kho' },
    { id: 's6', name: 'Giám sát lối thoát hiểm', description: 'Cảnh báo khi cửa thoát hiểm bị chặn hoặc khóa sai quy định' },
  ],
  counting: [
    { id: 'c1', name: 'Đếm lượt khách ra vào', description: 'Đếm số khách hàng đi vào và ra cửa hàng theo ngày' },
    { id: 'c2', name: 'Đếm xe tại bãi đỗ', description: 'Đếm ô tô và xe máy đi qua cổng bãi đỗ xe' },
    { id: 'c3', name: 'Giới hạn sức chứa', description: 'Cảnh báo khi số người trong phòng vượt quá giới hạn tối đa' },
    { id: 'c4', name: 'Đếm sản lượng tự động', description: 'Đếm số hộp đi qua trạm kiểm tra mỗi ca làm việc' },
    { id: 'c5', name: 'Đếm xe tải ra vào cổng', description: 'Theo dõi số chuyến xe tải xuất nhập hàng trong ngày' },
    { id: 'c6', name: 'Hàng chờ tại quầy', description: 'Đếm số người đang xếp hàng chờ để điều phối nhân viên' },
  ],
  ppe: [
    { id: 'p1', name: 'Thiếu mũ bảo hộ', description: 'Phát hiện công nhân không đội mũ bảo hộ ở khu vực máy móc' },
    { id: 'p2', name: 'Thiếu áo phản quang', description: 'Cảnh báo nhân viên không mặc áo phản quang trong kho' },
    { id: 'p3', name: 'PPE đầy đủ trước ca', description: 'Yêu cầu đủ mũ, áo, găng tay trước khi vào khu hóa chất' },
    { id: 'p4', name: 'Thiếu kính bảo hộ', description: 'Báo khi nhân viên không mang kính bảo hộ tại khu hàn xì' },
    { id: 'p5', name: 'Không mang găng tay', description: 'Cảnh báo khi nhân viên dây chuyền thực phẩm không mang găng' },
    { id: 'p6', name: 'Thiếu khẩu trang', description: 'Phát hiện công nhân không đeo khẩu trang trong khu vực bụi' },
  ],
  fire: [
    { id: 'f1', name: 'Phát hiện khói sớm', description: 'Cảnh báo ngay khi thấy vệt khói nhỏ trong kho' },
    { id: 'f2', name: 'Phát hiện lửa trần', description: 'Báo khi thấy ngọn lửa hoặc ánh sáng cam bất thường' },
    { id: 'f3', name: 'Hút thuốc gần bồn xăng', description: 'Cảnh báo người hút thuốc gần khu vực chứa nhiên liệu' },
    { id: 'f4', name: 'Tia lửa hàn xì', description: 'Phát hiện tia lửa bắn vượt ra ngoài khu vực làm việc' },
  ],
  tra_congestion: [
    { id: 'tc1', name: 'Ùn tắc cổng chính', description: 'Cảnh báo khi có hơn 5 xe chờ tại cổng chính quá 3 phút' },
    { id: 'tc2', name: 'Kẹt xe lối ra', description: 'Phát hiện lối ra bãi đỗ xe bị kẹt dài' },
    { id: 'tc3', name: 'Ùn ứ khu vực trạm thu phí', description: 'Báo động khi lưu lượng xe dồn ứ kéo dài trước barie' },
    { id: 'tc4', name: 'Ùn tắc giao lộ', description: 'Nhận diện tình trạng các phương tiện không thể di chuyển tại ngã tư' },
  ],
  tra_smartpark: [
    { id: 'sp1', name: 'Bãi đỗ sắp đầy', description: 'Cảnh báo khi số chỗ trống trong bãi xe dưới 10%' },
    { id: 'sp2', name: 'Khu vực A hết chỗ', description: 'Phát hiện khu vực A đã sử dụng hết chỗ đỗ' },
    { id: 'sp3', name: 'Đỗ xe sai vạch', description: 'Cảnh báo xe đỗ lấn vạch, chiếm 2 ô đỗ cùng lúc' },
    { id: 'sp4', name: 'Chiếm chỗ VIP/Khuyết tật', description: 'Phát hiện xe lạ đỗ vào khu vực ưu tiên đã được đăng ký' },
  ],
  bld_inout: [
    { id: 'bi1', name: 'Nhân viên hành chính', description: 'Đếm nhân viên đi vào/ra qua cổng chính để theo dõi lưu lượng' },
    { id: 'bi2', name: 'Khách vãng lai', description: 'Đếm lượng khách đi vào sảnh lễ tân trong giờ làm việc' },
    { id: 'bi3', name: 'Lưu lượng thang máy', description: 'Đếm số lượng người ra vào sảnh thang máy tầng trệt' },
    { id: 'bi4', name: 'Ra vào ngoài giờ', description: 'Đếm số lượng người vẫn còn ra vào toà nhà sau 20:00' },
  ],
  bld_public_density: [
                  ],
  hc_restricted: [
                  ],
  hc_crowd_restricted: [
                  ],
  edu_escape: [
                  ],
  edu_cheating: [
                  ],
  edu_weapons: [
                  ],
  ap_abandoned_baggage: [
                  ],
  ap_restricted: [
                  ],
  ap_baggage_carousel: [
                  ],
  ap_weapon: [
                  ],
  ap_safety_line: [
                  ],
  bld_restricted: [
                  ],
  edu_recess: [
                  ],
  ap_queue: [
                  ],
  traffic: [
                          ],
  behavior: [
                      ],
  retail_analytics: [
    { id: 'r1', name: 'Heatmap lưu lượng', description: 'Phân tích vị trí khách đi lại nhiều nhất trong cửa hàng' },
    { id: 'r2', name: 'Thời gian dừng chân tại kệ', description: 'Đo thời gian trung bình khách hàng dừng lại và tương tác tại từng khu kệ hàng' },
    { id: 'r3', name: 'Kệ hàng bị trống', description: 'Cảnh báo khi kệ hàng trống để nhân viên bổ sung kịp thời' },
    { id: 'r4', name: 'Thời gian dừng tại kệ', description: 'Đo thời gian trung bình khách dừng lại tại từng kệ hàng' },
    { id: 'r5', name: 'Hành vi lấy rồi trả hàng', description: 'Theo dõi khách cầm lên rồi đặt lại sản phẩm để tối ưu kệ' },
    { id: 'r6', name: 'Phòng thử đồ chờ lâu', description: 'Cảnh báo khi phòng thử đồ có hàng chờ dài bất thường' },
  ],
};

// Per-use-case example prompts for Smart mode placeholder
const TASK_EXAMPLE_PROMPTS: Record<string, string> = {
  sec_intrusion:     'VD: "Cảnh báo khi có người xâm nhập khu vực cấm sau 22h"',
  sec_camera_tamper: 'VD: "Phát hiện camera bị che tay hoặc xịt sơn vào ống kính"',
  sec_door_abnormal: 'VD: "Cảnh báo khi cửa phòng server bị mở sau 18h"',
  sec_wrong_way:     'VD: "Phát hiện xe máy đi ngược chiều tại cổng ra"',
  sec_abandoned_object: 'VD: "Cảnh báo vali để ở sảnh quá 10 phút không ai lấy"',
  sec_loitering:     'VD: "Phát hiện người lảng vảng bất thường trước cổng chính"',
  sec_afterhours:    'VD: "Cảnh báo nếu còn người trong văn phòng sau 22h"',
  sec_assetloss:     'VD: "Báo động ngay nếu laptop trên bàn bị di dời khỏi vị trí"',
  sec_crowd:         'VD: "Cảnh báo khi có từ 5 người tụ tập trước cổng chính"',
  sec_vehicle_reid:  'VD: "Tìm kiếm xe tải màu trắng khả nghi trong bãi đỗ"',
  security:          'VD: "Phát hiện người di chuyển trong văn phòng sau 22h"',
  counting:          'VD: "Đếm số khách hàng đi qua cửa chính theo ngày"',
  ppe:               'VD: "Cảnh báo công nhân không đội mũ bảo hộ tại công trường"',
  fire:              'VD: "Cảnh báo sớm khi phát hiện khói hoặc ngọn lửa trong kho"',
  tra_alpr:          'VD: "Nhận diện biển số các xe ra vào cổng chính"',
  tra_count:         'VD: "Đếm số ô tô và xe máy đi qua vạch đếm"',
  tra_parking:       'VD: "Cảnh báo xe đỗ quá 15 phút tại khu vực cấm"',
  tra_speed:         'VD: "Phát hiện xe chạy quá 40km/h trong khu dân cư"',
  tra_congestion:    'VD: "Cảnh báo ùn tắc khi có hơn 5 xe chờ tại cổng"',
  tra_smartpark:     'VD: "Cảnh báo khi bãi đỗ sắp đầy dưới 10% chỗ trống"',
  prd_label:         'VD: "Phát hiện sản phẩm bị dán nhãn lệch hoặc rách bao bì"',
  prd_assembly:      'VD: "Cảnh báo bảng mạch thiếu linh kiện trên dây chuyền"',
  prd_counting:      'VD: "Đếm số thùng carton chạy qua băng chuyền"',
  prd_productivity:  'VD: "Theo dõi tốc độ băng chuyền và phát hiện khi dừng quá 2 phút"',
  hse_ppe:           'VD: "Cảnh báo công nhân không đội mũ bảo hộ tại công trường"',
  hse_machine:       'VD: "Báo động khi người đứng quá gần máy ép đang chạy"',
  hse_fight:         'VD: "Phát hiện ẩu đả giữa công nhân tại khu vực xưởng"',
  hse_fall:          'VD: "Cảnh báo ngay khi phát hiện người ngã và nằm yên quá 5 giây"',
  hse_phone:         'VD: "Phát hiện tài xế xe nâng sử dụng điện thoại khi lái"',
  hse_proximity:     'VD: "Cảnh báo khi người đi bộ đến gần xe nâng đang hoạt động"',
  fir_fire:          'VD: "Cảnh báo sớm khi có khói đen bốc lên từ kho bãi"',
  fir_smoking:       'VD: "Cảnh báo nhân viên hút thuốc tại khu vực cấm lửa"',
  fir_exit:          'VD: "Phát hiện thùng hàng chắn lối thoát hiểm"',
  ret_counting:      'VD: "Đếm số khách hàng đi vào cửa hàng theo ngày"',
  ret_heatmap:       'VD: "Phân tích vùng khách tập trung đông nhất tại quầy mỹ phẩm"',
  ret_shelf:         'VD: "Cảnh báo khi kệ trưng bày nước giải khát hết hàng"',
  ret_queue:         'VD: "Cảnh báo khi có hơn 5 khách xếp hàng chờ thanh toán"',
  ret_crowdanalysis: 'VD: "Thống kê tỷ lệ nam/nữ và độ tuổi khách mua sắm"',
  ret_staff_absence: 'VD: "Cảnh báo khi nhân viên rời quầy thu ngân quá 5 phút trong giờ làm việc"',
  retail_analytics:  'VD: "Phân tích vị trí khách đi lại nhiều nhất trong cửa hàng"',
  wh_forklift:       'VD: "Cảnh báo xe nâng chạy quá tốc độ trong kho hẹp"',
  wh_wrongzone:      'VD: "Phát hiện pallet xếp nhầm vào khu vực xuất hàng"',
  wh_inventory:      'VD: "Quét và đếm số pallet tồn trên kệ Rack"',
  wh_counting:       'VD: "Đếm số lượt xe nâng gắp hàng từ xe tải vào kho"',
  wh_truck:          'VD: "Đọc biển số và theo dõi thời gian xe tải dừng tại trạm"',
  wh_wrongitem:      'VD: "Phát hiện thùng hàng lẫn màu bị trộn vào dây chuyền"',
  bld_door_abnormal: 'VD: "Cảnh báo khi cửa kính sảnh chính bị mở quá lâu"',
  bld_elevator_queue: 'VD: "Báo động khi có quá nhiều người chờ thang máy giờ cao điểm"',
  bld_meeting_room:  'VD: "Phát hiện phòng họp không người nhưng máy chiếu vẫn bật"',
  bld_smoking:       'VD: "Cảnh báo khi có người hút thuốc tại hành lang chung"',
  bld_reception:     'VD: "Cảnh báo khi nhân viên rời quầy quá 5 phút trong giờ làm việc"',
  bld_restricted:    'VD: "Báo động nếu có người không phận sự vào phòng server"',
  bld_inout:         'VD: "Đếm nhân viên ra vào qua cổng chính theo ca"',
  bld_public_density: 'VD: "Đo mức độ đông đúc tại sảnh chính toà nhà"',
  hc_ppe_sterile:    'VD: "Cảnh báo bác sĩ không đội mũ trước khi vào phòng mổ"',
  hc_queue:          'VD: "Cảnh báo khu vực máy lấy số đang quá đông bệnh nhân"',
  hc_hand_hygiene:   'VD: "Cảnh báo nhân viên không sát khuẩn tay trước khi vào buồng bệnh"',
  hc_ppe_medical:    'VD: "Cảnh báo khách ra vào bệnh viện không đeo khẩu trang"',
  hc_restricted:     'VD: "Phát hiện người lạ vào kho thuốc ngoài giờ hành chính"',
  hc_crowd_restricted: 'VD: "Cảnh báo ùn ứ người nhà tại hành lang khu cấp cứu"',
  edu_leave:         'VD: "Cảnh báo khi học sinh rời khu vực lớp quá 10 phút trong giờ học"',
  edu_violence:      'VD: "Phát hiện đám đông học sinh tụ tập và xô xát ở sân trường"',
  edu_attendance:    'VD: "Điểm danh tự động và cảnh báo học sinh đi trễ"',
  edu_escape:        'VD: "Phát hiện học sinh leo tường ra khỏi trường trong giờ học"',
  edu_cheating:      'VD: "Phát hiện học sinh sử dụng điện thoại trong phòng thi"',
  edu_weapons:       'VD: "Cảnh báo ngay khi phát hiện dao/gậy trong khuôn viên trường"',
  edu_recess:        'VD: "Phát hiện học sinh tụ tập góc khuất sau nhà vệ sinh"',
  ap_abandoned_baggage: 'VD: "Cảnh báo vali để quá 5 phút tại sảnh chờ"',
  ap_restricted:     'VD: "Cảnh báo người lạ đi vào khu vực đường băng"',
  ap_baggage_carousel: 'VD: "Phát hiện kẹt hành lý hoặc ùn ứ trên băng chuyền"',
  ap_weapon:         'VD: "Cảnh báo khẩn khi phát hiện súng trong hành lý"',
  ap_safety_line:    'VD: "Báo động khi hành khách lấn qua vạch vàng lúc tàu đến"',
  ap_queue:          'VD: "Cảnh báo khi hàng chờ check-in quá dài"',
  traffic:           'VD: "Đọc biển số và đếm xe ra vào cổng công ty"',
  behavior:          'VD: "Phát hiện hành vi đánh nhau trong khuôn viên"',
  defect_surface:    'VD: "Phát hiện lỗi xước, móp trên bề mặt sản phẩm"',
  defect_assembly:   'VD: "Phát hiện linh kiện bị thiếu hoặc lắp ráp sai"',
  defect_label:      'VD: "Phát hiện in lỗi, chữ mờ trên tem nhãn"',
  defect_foreign:    'VD: "Phát hiện dị vật lạ nằm trong thùng thành phẩm"',
  label_inspection:  'VD: "Kiểm tra tem nhãn bị lệch hoặc rách bao bì"',
  assembly_inspection: 'VD: "Phát hiện bảng mạch thiếu linh kiện"',
};

const STANDARD_MODEL_NAMES: Record<string, string> = {
  security:         'YOLO-NAS-S · Phát hiện người',
  counting:         'YOLO-NAS-S · Đếm đối tượng',
  ppe:              'YOLO-NAS + PPE Classifier',
  fire:             'FireNet v2 · Khói & Lửa',
  traffic:          'YOLO-NAS + ALPR',
  behavior:         'YOLO-NAS + Action Recognition',
  retail_analytics: 'YOLO-NAS + Heatmap Analytics',
};

const TASK_LABELS: Record<string, string> = {
  security: 'Giám sát An ninh', counting: 'Đếm lưu lượng',
  defect_surface: 'Lỗi bề mặt', defect_assembly: 'Lỗi lắp ráp & Đóng gói',
  defect_label: 'Kiểm tra tem nhãn', defect_foreign: 'Phát hiện dị vật',
  label_inspection: 'Kiểm tra tem nhãn / Hạn dùng', assembly_inspection: 'Phát hiện lỗi lắp ráp',
  ppe: 'An toàn lao động', fire: 'Phòng cháy chữa cháy',
  traffic: 'Giao thông thông minh', behavior: 'Phân tích hành vi',
  retail_analytics: 'Phân tích Bán lẻ',
};

// ─── Use-Case Domain Definitions ─────────────────────────────────────────────

type UCParamType = 'text' | 'textarea' | 'number' | 'select' | 'select_text' | 'toggle' | 'multicheck' | 'multicheck_dynamic' | 'time_range' | 'time' | 'date_range' | 'slider_pct' | 'image' | 'file' | 'zone_hint' | 'line_hint' | 'bbox_per_field' | 'bbox_per_part' | 'card2' | 'card3' | 'license_plate_list' | 'zone_item_mapping' | 'weekly_schedule';

interface UCParam {
  key: string;
  label: string;
  type: UCParamType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  optional?: boolean;
  condition?: (values: any) => boolean;
  /** for multicheck_dynamic: key of another param whose value provides the options list */
  sourceKey?: string;
}

interface UCDef {
  id: string;
  name: string;
  taskMapType: string;
  desc?: string;
  needsImage?: boolean;
  imageLabel?: string;
  multipleImages?: boolean;
  params: UCParam[];
  /** Alert/threshold params */
  alertParams?: UCParam[];
}

interface DomainDef {
  key: string;
  name: string;
  color: string;
  useCases: UCDef[];
}

const DOMAINS: DomainDef[] = [
  {
    key: 'security', name: 'An ninh', color: 'blue',
    useCases: [
      { id: 'sec_intrusion', name: 'Xâm nhập vùng cấm', taskMapType: 'security', desc: 'Cảnh báo tự động khi có đối tượng đi vào vùng cấm.', params: [
        { key: 'zone', label: 'Vẽ vùng cấm cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng nào BỊ CẤM vào vùng này', type: 'select', options: ['Người', 'Xe máy', 'Xe ô tô', 'Xe tải', 'Bất kỳ đối tượng nào'] },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây/frame', placeholder: '3' },
      ],
        alertParams: [
          { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        ]},
      { id: 'sec_loitering', name: 'Phát hiện lưu lại quá thời gian', taskMapType: 'security', desc: 'Phát hiện đối tượng đứng lâu bất thường tại một khu vực.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng cần phát hiện', type: 'select', options: ['Người', 'Xe', 'Bất kỳ'] },
        { key: 'maxStay', label: 'Thời gian tối đa ở lại', type: 'number', unit: 'phút' },
      ]},
      { id: 'sec_afterhours', name: 'Phát hiện xâm nhập ngoài giờ', taskMapType: 'security', desc: 'Giám sát và cảnh báo hoạt động trong khung giờ vắng người.', params: [
        { key: 'workHours', label: 'Giờ làm việc bình thường', type: 'time_range' },
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây' },
      ],
        alertParams: []},
      { id: 'sec_assetloss', name: 'Phát hiện vật thể rời vị trí', taskMapType: 'security', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tài sản cần bảo vệ (giúp AI nhận dạng chính xác hơn)', desc: 'Báo động khi đồ vật quan trọng bị di dời khỏi vị trí.', params: [
        { key: 'assetImage', label: 'Upload ảnh vật thể cần tìm', type: 'file' },
        { key: 'zone', label: 'Vùng đặt tài sản', type: 'zone_hint' },
        { key: 'missingTime', label: 'Tài sản mất bao lâu mới báo', type: 'number', unit: 'giây' },
        { key: 'tempMoveTime', label: 'Thời gian cho phép di chuyển tạm', type: 'number', unit: 'phút' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây', placeholder: '10' },
      ],
        alertParams: []},

      { id: 'sec_crowd', name: 'Phát hiện tụ tập đông người', taskMapType: 'security', desc: 'Nhận diện tình trạng tụ tập đông người bất thường.', params: [
        { key: 'zone', label: 'Vùng cần kiểm soát', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số người tối đa cho phép / tối thiểu để báo', type: 'number', placeholder: '5' },
        { key: 'minDuration', label: 'Thời gian tụ tập tối thiểu', type: 'number', unit: 'giây', placeholder: '10' },
      ]},
      { id: 'sec_camera_tamper', name: 'Phát hiện camera bị che, bị xoay lệch, mất nét, hình ảnh quá tối hoặc mất tín hiệu.', taskMapType: 'security', desc: 'Phát hiện trường hợp camera bị vật thể che trước ống kính, bị dán băng, bị che bởi tay/người/vật, hoặc vùng nhìn bị che quá nhiều khiến hệ thống không thể giám sát bình thường.', params: [
        { key: 'occlusionThreshold', label: 'Tỷ lệ khung hình bị che tối thiểu để báo', type: 'slider_pct' },
        { key: 'duration', label: 'Thời gian bị che liên tục mới cảnh báo', type: 'number', unit: 'giây' }
      ],
        alertParams: [
          { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] }
        ]},
      { id: 'sec_door_abnormal', name: 'Phát hiện cửa mở bất thường', taskMapType: 'security', desc: 'Phát hiện cửa kho, cửa phòng server, cửa thoát hiểm hoặc cửa khu vực hạn chế bị mở quá lâu hoặc mở ngoài khung giờ cho phép.', params: [
        { key: 'zone', label: 'Vị trí cửa cần giám sát', type: 'zone_hint' },
        { key: 'normalState', label: 'Trạng thái cửa bình thường', type: 'select', options: ['Đóng', 'Mở'] },
        { key: 'maxOpenSeconds', label: 'Thời gian mở tối đa cho phép', type: 'number', unit: 'giây' },
        { key: 'allowedHours', label: 'Khung giờ được phép mở cửa', type: 'time_range' },
      ],
        alertParams: [
          { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] }
        ]},
      { id: 'sec_abandoned_object', name: 'Phát hiện vật thể bỏ quên', taskMapType: 'security', desc: 'Phát hiện túi, hộp, vali, thùng hàng hoặc vật thể lạ bị để lại trong khu vực giám sát quá lâu.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'targetType', label: 'Loại vật thể cần theo dõi', type: 'multicheck', options: ['Túi', 'Hộp', 'Vali', 'Thùng hàng', 'Khác'] },
        { key: 'excludeType', label: 'Phân loại đối tượng loại trừ', type: 'multicheck', options: ['Người', 'Xe'] },
        { key: 'minSize', label: 'Kích thước vật thể tối thiểu', type: 'slider_pct' },
        { key: 'minStillTime', label: 'Thời gian vật thể đứng yên tối thiểu', type: 'number', unit: 'giây/phút' },
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] }
        ]},
    ]
  },
  {
    key: 'traffic', name: 'Giao thông/Bãi xe', color: 'amber',
    useCases: [
      { id: 'tra_alpr', name: 'Nhận diện biển số', taskMapType: 'traffic', desc: 'Tự động đọc biển số xe và đối chiếu danh sách trắng/đen.', params: [
        { key: 'vehicleTypes', label: 'Loại xe cần nhận diện', type: 'multicheck', options: ['Ô tô', 'Xe máy', 'Xe tải', 'Xe buýt'] },
        { key: 'whitelist', label: 'Danh sách xe được phép vào', type: 'license_plate_list', optional: true },
        { key: 'blacklist', label: 'Danh sách xe bị cấm', type: 'license_plate_list', optional: true },
      ]},
      { id: 'tra_count', name: 'Đếm phương tiện qua vạch', taskMapType: 'counting', desc: 'Đo lường số lượng phương tiện đi qua một vạch/vùng cụ thể.', params: [
        { key: 'vehicleTypes', label: 'Loại xe cần đếm', type: 'multicheck', options: ['Xe máy', 'Ô tô', 'Xe tải', 'Xe đạp', 'Tất cả'] },
        { key: 'direction', label: 'Hướng đếm', type: 'card3', options: ['Chỉ vào', 'Chỉ ra', 'Cả 2 chiều'] },
        { key: 'line', label: 'Vị trí vạch đếm', type: 'line_hint' },
        { key: 'ignoreParked', label: 'Bỏ qua xe đang đỗ (chỉ đếm xe di chuyển)', type: 'toggle', optional: true },
      ],
        alertParams: [
          { key: 'alertThreshold', label: 'Cảnh báo khi số xe vượt ngưỡng', type: 'number', unit: 'xe/giờ' }
        ]},
      { id: 'tra_parking', name: 'Phát hiện dừng đỗ sai quy định', taskMapType: 'traffic', desc: 'Phát hiện các phương tiện dừng đỗ tại khu vực cấm.', params: [
        { key: 'zone', label: 'Vùng cấm dừng đỗ', type: 'zone_hint' },
        { key: 'maxMinutes', label: 'Thời gian tối đa được dừng', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'hazardGrace', label: 'Xe bật đèn cảnh báo (hazard) được gia hạn thêm', type: 'toggle', optional: true },
        { key: 'exemptVehicles', label: 'Xe nào được miễn', type: 'multicheck', optional: true, options: ['Xe cứu thương', 'Xe cứu hỏa', 'Xe bảo trì'] },
      ]},
    ]
  },
  {
    key: 'production', name: 'Sản xuất', color: 'violet',
    useCases: [
      { id: 'prd_label', name: 'Kiểm tra tem nhãn / hạn dùng', taskMapType: 'label_inspection', needsImage: true, imageLabel: 'Ảnh mẫu sản phẩm (vị trí nhãn rõ)', desc: 'Kiểm tra lỗi in ấn, thiếu tem nhãn, bao bì rách nát.', params: [
        { key: 'fields', label: 'Trường thông tin cần đọc', type: 'multicheck', options: ['NSX', 'HSD', 'Số lô'] },
        { key: 'fieldZone', label: 'Vùng mỗi trường trên sản phẩm', type: 'zone_hint' },
        { key: 'mfgFormat', label: 'Định dạng Ngày sản xuất', type: 'select', options: ['DD/MM/YYYY', 'MM/YYYY', 'Khác'] },
        { key: 'expFormat', label: 'Định dạng Hạn sử dụng', type: 'select', options: ['DD/MM/YYYY', 'MM/YYYY', 'Khác'] },
        { key: 'batchFormat', label: 'Định dạng Số lô', type: 'text' },
        { key: 'language', label: 'Ngôn ngữ trên nhãn', type: 'select', options: ['Tiếng Việt', 'Tiếng Anh'] },
        { key: 'minShelfLife', label: 'HSD phải cách NSX tối thiểu', type: 'number', unit: 'ngày' },
        { key: 'minRemaining', label: 'HSD phải còn hạn tối thiểu', type: 'number', unit: 'ngày' }
      ], alertParams: []},
      { id: 'prd_assembly', name: 'Phát hiện lỗi lắp ráp', taskMapType: 'assembly_inspection', needsImage: true, multipleImages: true, imageLabel: 'Ảnh mẫu sản phẩm lắp đúng', desc: 'Phát hiện linh kiện bị thiếu, sai vị trí, lắp ráp ngược.', params: [
        { key: 'criticalParts', label: 'Bộ phận nào là cần thiết', type: 'multicheck', options: ['Ốc vít', 'Bo mạch', 'Vỏ', 'Dây cáp', 'Màn hình', 'Pin', 'Nút bấm', 'Cảm biến', 'Đế', 'Lò xo'] },
        { key: 'partZone', label: 'Vùng từng bộ phận', type: 'zone_hint' },
        { key: 'multiVersion', label: 'Sản phẩm có nhiều phiên bản không', type: 'toggle' },
      ]},
      { id: 'prd_counting', name: 'Giám sát dây chuyền gặp sự cố', taskMapType: 'counting', needsImage: true, multipleImages: true, imageLabel: 'Ảnh sản phẩm trên băng chuyền (tùy chọn — để AI nhận dạng chính xác hơn)', desc: 'Cảnh báo ngay khi dây chuyền ngừng hoạt động đột ngột hoặc phát hiện sản phẩm bị kẹt, ứ đọng tại một điểm trên băng tải.', params: [
        { key: 'zone', label: 'Vùng dây chuyền cần giám sát', type: 'zone_hint' },
        { key: 'outputLine', label: 'Vị trí đếm sản phẩm đầu ra', type: 'line_hint' },
        { key: 'beltDirection', label: 'Chiều di chuyển của băng chuyền', type: 'card3', options: ['Trái → Phải', 'Phải → Trái', 'Trên → Dưới'] },
        { key: 'shiftHours', label: 'Khung giờ hoạt động của ca sản xuất', type: 'time_range' },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
      ],
        alertParams: [
          { key: 'stopAlertSecs', label: 'Băng chuyền dừng đột ngột quá', type: 'number', unit: 'giây', placeholder: '10' },
          { key: 'jamAlertSecs', label: 'Sản phẩm kẹt / ùn ứ tại một điểm quá', type: 'number', unit: 'giây', placeholder: '5' },
          { key: 'rateAlert', label: 'Tốc độ ra sản phẩm thấp hơn', type: 'number', unit: 'sp/phút', placeholder: '20' },
        ]},
    ]
  },
  {
    key: 'safety', name: 'An toàn lao động', color: 'orange',
    useCases: [
      { id: 'hse_ppe', name: 'Phát hiện thiếu trang thiết bị bảo hộ', taskMapType: 'ppe', needsImage: true, multipleImages: true, imageLabel: 'Ảnh trang bị bảo hộ đúng chuẩn', desc: 'Kiểm tra nhân viên có mặc đủ áo phản quang, mũ, kính bảo hộ.', params: [
        { key: 'zone', label: 'Khu vực yêu cầu PPE', type: 'zone_hint' },
        { key: 'requiredPPE', label: 'PPE bắt buộc tại khu vực này', type: 'multicheck', options: ['Mũ bảo hộ', 'Áo phản quang', 'Găng tay', 'Giày bảo hộ'] },
        { key: 'ppeColor', label: 'Màu PPE tại cơ sở', type: 'text' },
        { key: 'allowTempRemoval', label: 'Cho phép tháo PPE tạm trong', type: 'number', unit: 'giây', placeholder: '30' },
        { key: 'triggerCondition', label: 'Điều kiện kích hoạt', type: 'card2', options: ['Bước vào vùng', 'Luôn kiểm tra trong vùng'] }
      ],
        alertParams: [
          { key: 'confirmFrames', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'frame/giây' }
        ]},
      { id: 'hse_machine', name: 'Xâm nhập vùng cấm', taskMapType: 'security', desc: 'Báo động khi người hoặc phương tiện xâm nhập vào vùng cấm quanh máy móc, thiết bị nguy hiểm đang hoạt động.', params: [
        { key: 'zone', label: 'Vẽ vùng cấm cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng nào BỊ CẤM vào vùng này', type: 'select', options: ['Người', 'Xe máy', 'Xe ô tô', 'Xe tải', 'Bất kỳ đối tượng nào'] },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'maxStaySeconds', label: 'Thời gian lưu lại tối đa', type: 'number', unit: 'giây', placeholder: '60' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây/frame', placeholder: '3' },
      ], alertParams: [
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'hse_fight', name: 'Phát hiện đánh nhau / ẩu đả', taskMapType: 'behavior', desc: 'Phát hiện hành vi đánh nhau, xô xát, ẩu đả giữa các cá nhân trong khu vực sản xuất hoặc kho bãi.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'minPeople', label: 'Số người tối thiểu liên quan', type: 'number', placeholder: '2' },
        { key: 'detectWeapon', label: 'Nhận diện có sử dụng hung khí không', type: 'toggle' },
        { key: 'motionIntensity', label: 'Cường độ chuyển động bất thường', type: 'slider_pct' },
        { key: 'dangerLevel', label: 'Mức độ nguy hiểm', type: 'select', options: ['Nhẹ (ẩu đả)', 'Trung bình', 'Nghiêm trọng (có hung khí)'] },
        { key: 'fightDuration', label: 'Thời gian xảy ra hành vi liên tục', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'hse_fall', name: 'Phát hiện người ngã / đột quỵ', taskMapType: 'behavior', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tham chiếu khu vực / tư thế bình thường', desc: 'Phát hiện người ngã xuống đất đột ngột hoặc bất động bất thường trong khu vực giám sát.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'normalPosture', label: 'Tư thế làm việc bình thường (có cúi/ngồi thường xuyên không)', type: 'toggle' },
        { key: 'confirmSeconds', label: 'Xác nhận ngã sau khi nằm yên', type: 'number', unit: 'giây', placeholder: '3' },
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Trung bình', 'Cao', 'Khẩn cấp'] },
        ]},
    ]
  },
  {
    key: 'fire', name: 'PCCC', color: 'rose',
    useCases: [
      { id: 'fir_fire', name: 'Phát hiện khói/lửa', taskMapType: 'fire', desc: 'Phát hiện sớm các dấu hiệu hỏa hoạn qua camera thường.', params: [
        { key: 'detectTarget', label: 'Phát hiện', type: 'multicheck', options: ['Khói', 'Lửa'] },
        { key: 'sensitivity', label: 'Mức độ nhạy', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'dustyEnv', label: 'Môi trường có hơi / bụi thường xuyên không', type: 'toggle' },
        { key: 'allowedZone', label: 'Khu vực được phép có lửa / nhiệt', type: 'zone_hint' },
        { key: 'material', label: 'Vật liệu trong khu vực', type: 'select', options: ['Gỗ', 'Nhựa', 'Hóa chất', 'Dầu'] },
        { key: 'safeDist', label: 'Vùng an toàn xung quanh', type: 'number', unit: 'mét' }
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Khẩn cấp'] }
        ]},
      { id: 'fir_smoking', name: 'Phát hiện hút thuốc vùng cấm', taskMapType: 'behavior', desc: 'Phát hiện hành vi hút thuốc lá ở nơi có nguy cơ cháy nổ.', params: [
        { key: 'zone', label: 'Vùng cấm hút thuốc', type: 'zone_hint' },
        { key: 'sensitivity', label: 'Mức độ nhạy', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận', type: 'number', unit: 'giây' },
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        ]},
      { id: 'fir_exit', name: 'Phát hiện lỗi thoát hiểm bị chặn', taskMapType: 'security', desc: 'Cảnh báo khi hành lang, lối thoát hiểm bị vật cản che lấp.', params: [
        { key: 'exitZone', label: 'Vị trí lối thoát hiểm', type: 'zone_hint' },
        { key: 'loadingHours', label: 'Giờ bốc dỡ hàng qua lối thoát', type: 'time_range' },
        { key: 'blockRatio', label: 'Coi là bị chặn khi bị che %', type: 'slider_pct' },
        { key: 'confirmSeconds', label: 'Báo sau bao lâu', type: 'number', unit: 'giây' },
      ],
        alertParams: []},
    ]
  },
  {
    key: 'retail', name: 'Bán lẻ & khách hàng', color: 'emerald',
    useCases: [
      { id: 'ret_counting', name: 'Đếm khách ra/vào', taskMapType: 'counting', desc: 'Đo lường lượt khách hàng đi qua cửa/vào khu vực.', params: [
        { key: 'line', label: 'Vị trí cửa vào', type: 'line_hint' },
        { key: 'direction', label: 'Hướng đếm', type: 'card3', options: ['Chỉ vào', 'Chỉ ra', 'Cả 2 chiều'] },
        { key: 'maxSimultaneous', label: 'Cảnh báo khi có bao nhiêu khách đồng thời', type: 'number', optional: true },
        { key: 'alertThreshold', label: 'Ngưỡng số người ra/vào bất thường', type: 'number', unit: 'người', optional: true },
        { key: 'peakHours', label: 'Giờ cao điểm bình thường', type: 'time_range', optional: true },
      ]},
      { id: 'ret_shelf', name: 'Phát hiện kệ hàng đổ', taskMapType: 'retail_analytics', needsImage: true, multipleImages: true, imageLabel: 'Hình ảnh tham chiếu kệ bình thường', desc: 'Cảnh báo ngay khi kệ hàng bị đổ, nghiêng hoặc hàng hóa rơi vãi gây mất an toàn hoặc tổn thất hàng hóa.', params: [
        { key: 'refImage', label: 'Hình ảnh tham chiếu kệ bình thường', type: 'image' },
        { key: 'tiltThreshold', label: 'Góc nghiêng tối đa cho phép', type: 'slider_pct' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},

      { id: 'ret_shelf_empty', name: 'Phát hiện kệ hàng trống', taskMapType: 'retail_analytics', needsImage: true, multipleImages: true, imageLabel: 'Ảnh kệ hàng khi đầy', desc: 'Phát hiện kệ hàng bị trống hoặc thiếu hàng, nhắc nhân viên bổ sung kịp thời.', params: [
        { key: 'refImageFull', label: 'Ảnh kệ hàng khi đầy', type: 'image' },
        { key: 'inventoryTime', label: 'Giờ kiểm kê đầu ngày', type: 'time' },
        { key: 'allowRearrange', label: 'Hàng có được sắp xếp lại thường xuyên không', type: 'toggle' },
        { key: 'emptyThreshold', label: 'Coi là trống khi', type: 'slider_pct' },
          { key: 'restockMinutes', label: 'Cần bổ sung hàng trong bao lâu', type: 'number', unit: 'phút', placeholder: '15' },
        ], alertParams: []},

      { id: 'ret_staff_absence', name: 'Rời khỏi vị trí', taskMapType: 'behavior', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tham chiếu nhận diện đối tượng (đồng phục, thẻ, khuôn mặt)', desc: 'Phát hiện nhân viên, học sinh hoặc khách rời khỏi vị trí quy định quá thời gian cho phép mà không có phép.', params: [
        { key: 'target', label: 'Đối tượng giám sát', type: 'select', options: ['Nhân viên', 'Học sinh', 'Khách'] },
        { key: 'recognition', label: 'Cách nhận diện', type: 'select', options: ['Đồng phục', 'Thẻ', 'Hình ảnh'] },
        { key: 'zone', label: 'Vùng cần giám sát', type: 'zone_hint' },
        { key: 'breakHours', label: 'Giờ nghỉ / Ngoại lệ', type: 'time_range', optional: true },
        { key: 'maxAbsenceTime', label: 'Thời gian rời vị trí tối đa cho phép', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'receiver', label: 'Người nhận cảnh báo', type: 'text' },
      ]},
    ]
  },
  {
    key: 'warehouse', name: 'Kho bãi & logistics', color: 'cyan',
    useCases: [
      { id: 'wh_forklift', name: 'Xâm nhập vùng cấm', taskMapType: 'security', desc: 'Cảnh báo khi người đi bộ vào làn xe nâng, hoặc xe nâng/xe tải đi vào khu vực dành cho người đi bộ — ngăn ngừa va chạm và tai nạn trong kho.', params: [
        { key: 'zone', label: 'Vẽ vùng cấm cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng nào BỊ CẤM vào vùng này', type: 'select', options: ['Người đi bộ', 'Xe nâng', 'Xe tải', 'Bất kỳ đối tượng nào'] },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây/frame', placeholder: '3' },
      ],
        alertParams: [
          { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
          { key: 'maxStaySeconds', label: 'Thời gian lưu lại tối đa', type: 'number', unit: 'giây', placeholder: '60' },
        ]},
      { id: 'wh_counting', name: 'Đếm hàng xuất/nhập kho', taskMapType: 'counting', needsImage: true, multipleImages: true, imageLabel: 'Ảnh kiện hàng cần đếm (tuỳ chọn — để trống = đếm tất cả)', desc: 'Đếm số lượng hàng hóa được xếp lên hoặc hạ xuống xe tải.', params: [
        { key: 'line', label: 'Vị trí cổng xuất / nhập', type: 'line_hint' },
        { key: 'plannedQty', label: 'Số lượng theo kế hoạch hôm nay', type: 'number', placeholder: '500' },
        { key: 'truckCount', label: 'Hàng đến từ bao nhiêu chuyến xe', type: 'number', optional: true, placeholder: '3' },
      ]},
      { id: 'wh_truck', name: 'Nhận diện biển số', taskMapType: 'traffic', desc: 'Tự động đọc và ghi nhận biển số xe tải vào/ra kho, đối chiếu danh sách xe được phép và cảnh báo xe không đăng ký.', params: [
        { key: 'vehicleTypes', label: 'Loại xe cần nhận diện', type: 'multicheck', options: ['Ô tô', 'Xe máy', 'Xe tải', 'Xe buýt'] },
        { key: 'action', label: 'Hành động khi phát hiện', type: 'select', options: ['Chỉ ghi log', 'Cảnh báo', 'Gọi webhook mở barrier'] },
        { key: 'whitelist', label: 'Danh sách xe được phép vào', type: 'license_plate_list', optional: true },
        { key: 'blacklist', label: 'Danh sách xe bị cấm', type: 'license_plate_list', optional: true },
      ]},
      { id: 'wh_wrongitem', name: 'Phát hiện hàng đặt sai khu vực', taskMapType: 'security', desc: 'Phát hiện hàng hóa, pallet hoặc thùng hàng được đặt vào khu vực không đúng quy định, ví dụ hàng thành phẩm đặt ở khu nguyên liệu, hàng chờ xuất đặt sai lane, hàng nguy hiểm đặt sai vùng.', params: [
        { key: 'zoneList', label: 'Danh sách khu vực kho', type: 'text', placeholder: 'VD: A1, A2, B1, B2, C1 (phân cách bằng dấu phẩy)' },
        { key: 'itemType', label: 'Loại hàng / ký hiệu hàng', type: 'text', placeholder: 'VD: Hàng điện tử, Thực phẩm, Hàng nguy hiểm' },
        { key: 'validZone', label: 'Quy tắc: loại hàng → khu vực hợp lệ', type: 'zone_item_mapping' },
        { key: 'recognitionMethod', label: 'Cách nhận diện hàng', type: 'select', options: ['QR Code / Mã vạch', 'Màu sắc / ký hiệu in trên thùng', 'Hình dạng / kích thước', 'Nhãn mác / chữ in'] },
        { key: 'tempTime', label: 'Thời gian cho phép đặt tạm', type: 'number', unit: 'phút', placeholder: '10' },
      ]},
    ]
  },
  {
    key: 'building', name: 'Tòa nhà & văn phòng', color: 'indigo',
    useCases: [
      { id: 'bld_inout', name: 'Đếm người ra/vào', taskMapType: 'counting', desc: 'Đếm và ghi nhận số lượt người ra/vào tòa nhà, sảnh chính, văn phòng, tầng làm việc hoặc khu vực kiểm soát.', params: [
        { key: 'line', label: 'Vị trí cửa ra/vào', type: 'line_hint' },
        { key: 'direction', label: 'Hướng đếm', type: 'card3', options: ['Chỉ vào', 'Chỉ ra', 'Cả 2 chiều'] },
        { key: 'maxSimultaneous', label: 'Cảnh báo khi có bao nhiêu người đồng thời', type: 'number', optional: true },
        { key: 'alertThreshold', label: 'Ngưỡng số người ra/vào bất thường', type: 'number', unit: 'người', optional: true },
        { key: 'peakHours', label: 'Giờ cao điểm bình thường', type: 'time_range', optional: true },
      ]},
      { id: 'bld_door_abnormal', name: 'Phát hiện cửa mở bất thường', taskMapType: 'security', desc: 'Phát hiện cửa phòng server, cửa kho, cửa kỹ thuật, cửa thoát hiểm hoặc cửa khu vực hạn chế bị mở quá lâu hoặc mở ngoài khung giờ cho phép.', params: [
        { key: 'zone', label: 'Vị trí cửa cần giám sát', type: 'zone_hint' },
        { key: 'normalState', label: 'Trạng thái cửa bình thường', type: 'select', options: ['Đóng', 'Mở'] },
        { key: 'maxOpenTime', label: 'Thời gian mở tối đa cho phép', type: 'number', unit: 'giây/phút' },
        { key: 'allowedHours', label: 'Khung giờ được phép mở cửa', type: 'time_range' },
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] }
        ]},
      { id: 'bld_smoking', name: 'Phát hiện hút thuốc vùng cấm', taskMapType: 'behavior', desc: 'Phát hiện hành vi hút thuốc trong khu vực cấm như hành lang, thang bộ, nhà vệ sinh, sảnh, phòng kỹ thuật hoặc khu vực văn phòng.', params: [
        { key: 'zone', label: 'Vùng cấm hút thuốc', type: 'zone_hint' },
        { key: 'sensitivity', label: 'Mức độ nhạy', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận', type: 'number', unit: 'giây' },
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        ]},
      { id: 'bld_reception', name: 'Rời khỏi vị trí', taskMapType: 'behavior', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tham chiếu nhận diện đối tượng (đồng phục, thẻ, khuôn mặt)', desc: 'Phát hiện nhân viên, học sinh hoặc khách rời khỏi vị trí quy định quá thời gian cho phép mà không có phép.', params: [
        { key: 'target', label: 'Đối tượng giám sát', type: 'select', options: ['Nhân viên', 'Học sinh', 'Khách'] },
        { key: 'recognition', label: 'Cách nhận diện', type: 'select', options: ['Đồng phục', 'Thẻ', 'Hình ảnh'] },
        { key: 'zone', label: 'Vùng cần giám sát', type: 'zone_hint' },
        { key: 'breakHours', label: 'Giờ nghỉ / Ngoại lệ', type: 'time_range', optional: true },
        { key: 'maxAbsenceTime', label: 'Thời gian rời vị trí tối đa cho phép', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'receiver', label: 'Người nhận cảnh báo', type: 'text' },
      ]},
    ]
  },
  {
    key: 'healthcare', name: 'Y tế', color: 'teal',
    useCases: [
      { id: 'hc_ppe_sterile', name: 'Kiểm tra trang bị bảo hộ y tế', taskMapType: 'ppe', needsImage: true, multipleImages: true, imageLabel: 'Ảnh trang phục bảo hộ đúng chuẩn', desc: 'Phát hiện nhân viên y tế không mặc đúng hoặc thiếu trang phục bảo hộ bắt buộc khi vào khu vực vô khuẩn, ICU, phòng mổ hoặc khu nguy hiểm lây nhiễm.', params: [
        { key: 'zone', label: 'Vùng yêu cầu bảo hộ', type: 'zone_hint' },
        { key: 'requiredPPE', label: 'Trang bị bắt buộc', type: 'multicheck', options: ['Áo mổ / Áo cách ly', 'Mũ phẫu thuật', 'Khẩu trang N95', 'Tấm chắn mặt', 'Găng tay', 'Bao giày'] },
        { key: 'ppeColors', label: 'Màu trang phục tại cơ sở', type: 'text', placeholder: 'Nhập màu tương ứng mỗi loại' },
      ],
        alertParams: [
          { key: 'confirmFrames', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'frame' }
        ]},
      { id: 'hc_restricted', name: 'Xâm nhập vùng cấm', taskMapType: 'security', desc: 'Phát hiện người vào khu vực cấm (kho thuốc, phòng mổ, ICU, khu cách ly) hoặc tụ tập đông người vượt giới hạn trong vùng hạn chế.', params: [
        { key: 'zone', label: 'Vẽ vùng cấm cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng nào BỊ CẤM vào vùng này', type: 'select', options: ['Người lạ / không có thẻ', 'Bất kỳ người nào', 'Bất kỳ đối tượng nào'] },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'workHours', label: 'Khung giờ hành chính (ngoài giờ = cấm tuyệt đối)', type: 'time_range' },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây/frame', placeholder: '3' },
      ],
        alertParams: [
          { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
          { key: 'maxStaySeconds', label: 'Thời gian lưu lại tối đa', type: 'number', unit: 'giây', placeholder: '60' },
        ]},
      { id: 'hc_crowd', name: 'Phát hiện tụ tập đông người', taskMapType: 'security', desc: 'Phát hiện tình trạng tụ tập đông người bất thường tại hành lang, phòng chờ, khu cấp cứu hoặc các vùng cần kiểm soát trong cơ sở y tế.', params: [
        { key: 'zone', label: 'Vùng cần kiểm soát', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số người tối đa cho phép / tối thiểu để báo', type: 'number', placeholder: '5' },
        { key: 'minDuration', label: 'Thời gian tụ tập tối thiểu', type: 'number', unit: 'giây', placeholder: '10' },
      ]},
      { id: 'hc_fall', name: 'Phát hiện người ngã / đột quỵ', taskMapType: 'behavior', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tham chiếu khu vực / tư thế bình thường', desc: 'Phát hiện bệnh nhân hoặc người cao tuổi ngã xuống đất đột ngột hoặc bất động bất thường trong khu vực giám sát.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'normalPosture', label: 'Tư thế bình thường có cúi/ngồi thường xuyên không', type: 'toggle' },
        { key: 'confirmSeconds', label: 'Xác nhận ngã sau khi nằm yên', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Trung bình', 'Cao', 'Khẩn cấp'] },
      ]},

    ]
  },
  {
    key: 'education', name: 'Giáo dục', color: 'fuchsia',
    useCases: [
      { id: 'edu_leave', name: 'Rời khỏi vị trí', taskMapType: 'security', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tham chiếu nhận diện đối tượng (đồng phục, thẻ, khuôn mặt)', desc: 'Phát hiện nhân viên, học sinh hoặc khách rời khỏi vị trí quy định quá thời gian cho phép mà không có phép.', params: [
        { key: 'target', label: 'Đối tượng giám sát', type: 'select', options: ['Nhân viên', 'Học sinh', 'Khách'] },
        { key: 'recognition', label: 'Cách nhận diện', type: 'select', options: ['Đồng phục', 'Thẻ', 'Hình ảnh'] },
        { key: 'zone', label: 'Vùng cần giám sát', type: 'zone_hint' },
        { key: 'breakHours', label: 'Giờ nghỉ / Ngoại lệ', type: 'time_range', optional: true },
        { key: 'maxAbsenceTime', label: 'Thời gian rời vị trí tối đa cho phép', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây', placeholder: '3' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'receiver', label: 'Người nhận cảnh báo', type: 'text' },
      ]},

      { id: 'edu_violence', name: 'Phát hiện ẩu đả, bạo lực học đường', taskMapType: 'behavior', desc: 'Phát hiện hành vi ẩu đả, đánh nhau, bắt nạt giữa học sinh tại hành lang, nhà vệ sinh, sân trường, góc khuất.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'minPeople', label: 'Số người tối thiểu liên quan', type: 'number' },
        { key: 'confirmSeconds', label: 'Thời gian hành vi bất thường liên tục', type: 'number', unit: 'giây' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Theo dõi', 'Cảnh báo', 'Khẩn cấp'] },
      ]},
      { id: 'edu_cheating', name: 'Phát hiện hành vi gian lận thi cử', taskMapType: 'behavior', desc: 'Giám sát phòng thi, phát hiện học sinh nhìn bài nhau, trao đổi tài liệu, sử dụng điện thoại trong giờ thi.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'activeHours', label: 'Giờ thi', type: 'time_range' },
        { key: 'detectPhone', label: 'Phát hiện sử dụng điện thoại', type: 'toggle' },
        { key: 'detectLooking', label: 'Phát hiện quay sang người bên cạnh', type: 'toggle' },
        { key: 'violationCount', label: 'Số lần vi phạm trước khi báo', type: 'number' },
        { key: 'violationDuration', label: 'Thời gian vi phạm tối thiểu', type: 'number', unit: 'giây' },
      ]},

      { id: 'edu_weapons', name: 'Phát hiện vật nguy hiểm trong trường', taskMapType: 'security', desc: 'Phát hiện học sinh mang vũ khí, vật sắc nhọn, hoặc mang theo đồ vật không phù hợp vào trường.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'targetType', label: 'Đối tượng cần phát hiện', type: 'multicheck', options: ['Dao', 'Vũ khí', 'Gậy', 'Bình xịt'] }
      ],
        alertParams: [
          { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Theo dõi', 'Khẩn cấp'] },
          { key: 'confirmFrames', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'frame' }
        ]},
    ]
  },
  {
    key: 'transport', name: 'Sân bay/ga tàu', color: 'sky',
    useCases: [
      { id: 'ap_abandoned_baggage', name: 'Phát hiện vật thể bỏ quên', taskMapType: 'security', desc: 'Phát hiện hành lý, túi xách, thùng hàng hoặc bất kỳ vật thể nào bị bỏ lại tại sảnh, phòng chờ, ga tàu quá thời gian quy định.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'objectTypes', label: 'Loại vật thể cần theo dõi', type: 'multicheck', options: ['Túi', 'Hộp', 'Vali', 'Thùng hàng', 'Khác'] },
        { key: 'excludeObjects', label: 'Phân loại đối tượng loại trừ', type: 'multicheck', options: ['Thùng rác cố định', 'Xe đẩy hành lý', 'Cột chắn', 'Biển báo'] },
        { key: 'minSizePct', label: 'Kích thước vật thể tối thiểu', type: 'slider_pct' },
        { key: 'idleSeconds', label: 'Thời gian vật thể đứng yên tối thiểu', type: 'number', unit: 'giây/phút', placeholder: '300' },
      ], alertParams: [
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Trung bình', 'Khẩn cấp'] },
      ]},
      { id: 'ap_restricted', name: 'Xâm nhập vùng cấm', taskMapType: 'security', desc: 'Cảnh báo khi người hoặc phương tiện xâm nhập vào khu vực hạn chế, đường băng, vạch an toàn tại sân bay/ga tàu.', params: [
        { key: 'zone', label: 'Vẽ vùng cấm cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng nào BỊ CẤM vào vùng này', type: 'select', options: ['Người', 'Xe máy', 'Xe ô tô', 'Xe tải', 'Bất kỳ đối tượng nào'] },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì / tuần tra (bỏ qua cảnh báo)', type: 'weekly_schedule', optional: true },
        { key: 'maxStaySeconds', label: 'Thời gian lưu lại tối đa', type: 'number', unit: 'giây', placeholder: '60' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận cảnh báo', type: 'number', unit: 'giây/frame', placeholder: '3' },
      ], alertParams: [
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
    ]
  },
];

const DOMAIN_COLOR_MAP: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    activeBg: 'bg-blue-600',    activeText: 'text-white', badge: 'bg-blue-100 text-blue-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   activeBg: 'bg-amber-500',   activeText: 'text-white', badge: 'bg-amber-100 text-amber-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  activeBg: 'bg-violet-600',  activeText: 'text-white', badge: 'bg-violet-100 text-violet-700' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  activeBg: 'bg-orange-500',  activeText: 'text-white', badge: 'bg-orange-100 text-orange-700' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    activeBg: 'bg-rose-600',    activeText: 'text-white', badge: 'bg-rose-100 text-rose-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-600', activeText: 'text-white', badge: 'bg-emerald-100 text-emerald-700' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    activeBg: 'bg-cyan-600',    activeText: 'text-white', badge: 'bg-cyan-100 text-cyan-700' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  activeBg: 'bg-indigo-600',  activeText: 'text-white', badge: 'bg-indigo-100 text-indigo-700' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    activeBg: 'bg-teal-600',    activeText: 'text-white', badge: 'bg-teal-100 text-teal-700' },
  fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', activeBg: 'bg-fuchsia-600', activeText: 'text-white', badge: 'bg-fuchsia-100 text-fuchsia-700' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     activeBg: 'bg-sky-600',     activeText: 'text-white', badge: 'bg-sky-100 text-sky-700' },
};

// ─── Helper: find a UCDef by id from DOMAINS ─────────────────────────────────
const findUCById = (id: string): UCDef | null =>
  DOMAINS.flatMap(d => d.useCases).find(uc => uc.id === id) ?? null;

// ─── Camera Preview Background (shared between steps) ───────────────────────

function CameraPreviewBg({ camType }: { camType?: string }) {
  switch (camType) {
    case 'retail':
      return (
        <div className="absolute inset-0 overflow-hidden flex flex-col justify-between p-3 select-none bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(rgba(248,250,252,0.85),rgba(248,250,252,0.85)),url('https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?q=80&w=1200&auto=format&fit=crop')" }}>
          <div className="flex justify-between w-full h-[30%]">
            <div className="w-[30%] bg-slate-200/80 border border-slate-300 rounded-md flex flex-col justify-center items-center text-[9px] text-slate-500 font-medium z-20">
              <span>Kệ Hàng A</span><span className="text-[8px] text-slate-400">Thời trang nam</span>
            </div>
            <div className="w-[30%] bg-slate-200/80 border border-slate-300 rounded-md flex flex-col justify-center items-center text-[9px] text-slate-500 font-medium z-20">
              <span>Kệ Hàng B</span><span className="text-[8px] text-slate-400">Đồ mỹ phẩm</span>
            </div>
          </div>
          <div className="h-[20%] w-[40%] mx-auto bg-slate-100 border border-slate-200 rounded-t-lg flex items-center justify-center text-[9px] text-slate-500 z-20">Quầy thu ngân</div>
        </div>
      );
    case 'warehouse':
      return (
        <div className="absolute inset-0 overflow-hidden flex flex-col justify-between p-3 select-none bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.85)),url('https://images.unsplash.com/photo-1586528116311-ad8ed745140c?q=80&w=1200&auto=format&fit=crop')" }}>
          <div className="flex justify-around w-full h-[25%] z-20 relative">
            {[['#01', true], ['#02', false], ['#03', true]].map(([n, filled]) => (
              <div key={String(n)} className={`w-[22%] ${filled ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-50/50 border-amber-200/50 text-amber-700/50'} border rounded-md p-1 text-[9px] font-medium flex flex-col justify-center items-center`}>
                <span>Kệ {n}</span>
                <span className={`text-[8px] ${filled ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>{filled ? 'Hàng lưu kho' : 'Trống'}</span>
              </div>
            ))}
          </div>
          <div className="h-[15%] w-full bg-slate-200/90 border border-slate-300 rounded-t-lg flex items-center justify-center text-[9px] text-slate-600 font-bold z-20">Cổng xuất nhập hàng</div>
        </div>
      );
    case 'parking':
      return (
        <div className="absolute inset-0 overflow-hidden flex p-3 select-none bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.85)),url('https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?q=80&w=1200&auto=format&fit=crop')" }}>
          <div className="w-[20%] h-full flex flex-col justify-between z-20">
            {[['P1', false], ['Đã đỗ', true], ['P3', false]].map(([l, filled]) => (
              <div key={String(l)} className={`h-[25%] w-[80%] border-y border-l ${filled ? 'border-slate-300 bg-emerald-50 text-emerald-600 font-bold' : 'border-slate-300 bg-slate-100 text-slate-400'} flex items-center justify-center text-[9px]`}>{String(l)}</div>
            ))}
          </div>
        </div>
      );
    case 'conveyor':
      return (
        <div className="absolute inset-0 overflow-hidden flex flex-col justify-center p-3 select-none bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.85)),url('https://images.unsplash.com/photo-1587293852726-6947eb45b4e9?q=80&w=1200&auto=format&fit=crop')" }}>
          <div className="h-[30%] w-full bg-slate-300 border-y-4 border-slate-400 shadow-inner relative flex items-center">
            <div className="absolute inset-0 flex justify-around pointer-events-none opacity-20">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="w-[2px] h-full bg-black" />)}
            </div>
          </div>
        </div>
      );
    default:
      return <div className="absolute inset-0 bg-slate-800 flex items-center justify-center"><CamIcon size={36} className="text-slate-600 opacity-40" /></div>;
  }
}

// ─── Convex Hull (reorders points so polygon is always non-self-intersecting) ─
function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const cross = (O: { x: number; y: number }, A: { x: number; y: number }, B: { x: number; y: number }) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// ─── Zone SVG Overlay ────────────────────────────────────────────────────────

function ZoneOverlay({ zones, drawingPoints, newZoneType }: {
  zones: DrawnZone[];
  drawingPoints: { x: number; y: number }[];
  newZoneType: 'line' | 'zone';
}) {
  // Live preview uses convex hull so shape is always clean while clicking
  const liveHull = newZoneType === 'zone' && drawingPoints.length >= 3
    ? convexHull(drawingPoints) : [];

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 1000 562.5" preserveAspectRatio="xMidYMid meet">

      {/* ── Saved zones ── */}
      {zones.map((z, zIdx) => {
        // exclude zones are always green; monitor zones use the palette
        const color = z.role === 'exclude' ? '#22c55e' : ZONE_COLORS[zIdx % ZONE_COLORS.length];
        const isExclude = z.role === 'exclude';

        if (z.type === 'line' && z.points.length >= 2) {
          const p0 = z.points[0], p1 = z.points[z.points.length - 1];
          const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
          return (
            <g key={z.id}>
              <line x1={`${p0.x}%`} y1={`${p0.y}%`} x2={`${p1.x}%`} y2={`${p1.y}%`}
                stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={isExclude ? '8 4' : undefined} />
              <circle cx={`${p0.x}%`} cy={`${p0.y}%`} r="4" fill={color} stroke="white" strokeWidth="1.5" />
              <circle cx={`${p1.x}%`} cy={`${p1.y}%`} r="4" fill={color} stroke="white" strokeWidth="1.5" />
              <rect x={`${mx - 5}%`} y={`${my - 3}%`} width={`${z.name.length * 1.2 + 4}%`} height="6%" rx="4" fill={color} />
              <text x={`${mx}%`} y={`${my}%`} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{z.name}</text>
            </g>
          );
        }

        if (z.type === 'zone' && z.points.length >= 3) {
          const pts = z.points;
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          return (
            <g key={z.id}>
              <polygon
                points={pts.map(p => `${p.x * 10} ${p.y * 5.625}`).join(' ')}
                fill={`${color}20`}
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeDasharray={isExclude ? '8 4' : undefined}
              />
              {pts.map((p, i) => (
                <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
              ))}
              {/* Label badge — show role icon for exclude zones */}
              <rect x={`${cx - 5}%`} y={`${cy - 3}%`} width={`${z.name.length * 1.2 + (isExclude ? 5 : 3)}%`} height="6%" rx="5" fill={color} />
              <text x={`${cx}%`} y={`${cy}%`} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{isExclude ? `✓ ${z.name}` : z.name}</text>
            </g>
          );
        }
        return null;
      })}

      {/* ── In-progress zone drawing ── */}
      {newZoneType === 'zone' && drawingPoints.length >= 3 && (
        <>
          {/* Convex hull fill — clean shape even when clicks are scattered */}
          <polygon
            points={liveHull.map(p => `${p.x * 10} ${p.y * 5.625}`).join(' ')}
            fill="rgba(16,185,129,0.18)"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Dashed closing edge so user can see the shape will close */}
          <line
            x1={`${liveHull[liveHull.length - 1].x}%`} y1={`${liveHull[liveHull.length - 1].y}%`}
            x2={`${liveHull[0].x}%`}                   y2={`${liveHull[0].y}%`}
            stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.55"
          />
        </>
      )}
      {/* In-progress line */}
      {newZoneType === 'line' && drawingPoints.length >= 2 && (
        <line
          x1={`${drawingPoints[0].x}%`} y1={`${drawingPoints[0].y}%`}
          x2={`${drawingPoints[drawingPoints.length - 1].x}%`} y2={`${drawingPoints[drawingPoints.length - 1].y}%`}
          stroke="#10b981" strokeWidth="3" strokeLinecap="round"
        />
      )}

      {/* Click dots with order numbers */}
      {drawingPoints.map((p, i) => (
        <g key={i}>
          <circle cx={`${p.x}%`} cy={`${p.y}%`} r="7" fill="#10b981" stroke="white" strokeWidth="2" />
          <text x={`${p.x}%`} y={`${p.y}%`} fill="white" fontSize="8" fontWeight="bold"
            textAnchor="middle" dominantBaseline="middle">{i + 1}</text>
          {i === drawingPoints.length - 1 && (
            <circle cx={`${p.x}%`} cy={`${p.y}%`} r="11" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.45">
              <animate attributeName="r" values="11;16;11" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.1;0.45" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PipelineBuilder({
  cameras, pipelines, setPipelines, setRules, onComplete, onSelectCamera,
}: PipelineBuilderProps) {

  const [currentStep, setCurrentStep] = useState<Step>('list');

  // Camera
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [cameraSearch, setCameraSearch] = useState('');
  const [activeZoneCamIdx, setActiveZoneCamIdx] = useState(0);

  // Task
  const [taskType, setTaskType] = useState<string>('security');
  const [flowName, setFlowName] = useState('');
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]); // [] = 24/7

  // AI mode
  const [userDescription, setUserDescription] = useState('');
  const [smartFlowState, setSmartFlowState] = useState<'idle' | 'preview' | 'applied'>('idle');

  const [routedModelName, setRoutedModelName] = useState('YOLO-NAS-S');

  const [routedModelReason, setRoutedModelReason] = useState('Mặc định');

  const [searchQuery, setSearchQuery] = useState('');

  const [searchScope, setSearchScope] = useState<'whole_scene' | 'roi'>('whole_scene');



  const [detectionTarget, setDetectionTarget] = useState('person');

  const [customTarget, setCustomTarget] = useState('');

  const [detectionRule, setDetectionRule] = useState('enter_area');

  const [alertDuration, setAlertDuration] = useState(10);

  const [alertCount, setAlertCount] = useState(0);

  const [cooldown, setCooldown] = useState(60);

  const [confidence, setConfidence] = useState(0.65);

  const [iou, setIou] = useState(0.45);

  const [tracker, setTracker] = useState('bytetrack');

  const [frameSkip, setFrameSkip] = useState(0);

  const [inferenceFps, setInferenceFps] = useState(15);

  const [maxLimit, setMaxLimit] = useState(5);

  const [similarityThreshold, setSimilarityThreshold] = useState(0.78);

  const [retrievalTopK, setRetrievalTopK] = useState(5);



  const [zoneCondition, setZoneCondition] = useState<'inside' | 'intersect'>('inside');



  const [countingProductImage, setCountingProductImage] = useState<string | null>(null);

  // AI context hints for smart mode
  const [aiContext, setAiContext] = useState({ environment: '', normalBehavior: '', specialNotes: '' });

  // Defect
  const [goldenSamples, setGoldenSamples] = useState<string[]>([]);
  const [inspectionROIs, setInspectionROIs] = useState<Record<number, BoundingBox[]>>({});
  const [enableSSIM, setEnableSSIM] = useState(true);
  const [enableCNN, setEnableCNN] = useState(false);
  const [enableOCR, setEnableOCR] = useState(false);
  const [expectedOCRText, setExpectedOCRText] = useState('');
  const [defectSensitivity, setDefectSensitivity] = useState<'low' | 'medium' | 'high'>('medium');

  // Alerts
  const [channels, setChannels] = useState({ zalo: true, email: false, telegram: false, webhook: false });

  // Multi-zone ROI
  const [multiZones, setMultiZones] = useState<Record<string, DrawnZone[]>>({});
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [newZoneName, setNewZoneName] = useState('Vùng A');
  const [newZoneType, setNewZoneType] = useState<'line' | 'zone'>('zone');
  const [newZoneRole, setNewZoneRole] = useState<'monitor' | 'exclude'>('monitor');

  // Domain / use-case browsing
const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedUseCaseDef, setSelectedUseCaseDef] = useState<UCDef | null>(null);
  const [useCaseParamValues, setUseCaseParamValues] = useState<Record<string, string>>({});
  const [useCaseAlertParamValues, setUseCaseAlertParamValues] = useState<Record<string, string>>({});
  const [plateDraft, setPlateDraft] = useState<Record<string, string>>({});
  const [plateError, setPlateError] = useState<Record<string, string>>({});
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, { day: string; from: string; to: string }>>({});
  const [useCaseImages, setUseCaseImages] = useState<string[]>([]);
  const [useCaseImageROIs, setUseCaseImageROIs] = useState<Record<number, BoundingBox[]>>({});
  const [inputMode, setInputMode] = useState<'standard' | 'smart'>('standard');
  const useCaseParamsCache = useRef<Record<string, Record<string, string>>>({});
  const useCaseImagesCache = useRef<Record<string, string[]>>({});
  const useCaseImageROIsCache = useRef<Record<string, Record<number, BoundingBox[]>>>({});
  const userDescriptionCache = useRef<Record<string, string>>({});
  const smartFlowStateCache = useRef<Record<string, 'idle' | 'preview' | 'applied'>>({});
  const multiZonesCache = useRef<Record<string, Record<string, DrawnZone[]>>>({});
  const drawingPointsCache = useRef<Record<string, { x: number; y: number }[]>>({});

  // UI
  // Performance presets
  const [perfPreset, setPerfPreset] = useState<'economy' | 'balanced' | 'precise'>('balanced');
  const [showAdvancedPerf, setShowAdvancedPerf] = useState(false);

  // Camera step preview
  const [previewCamIdx, setPreviewCamIdx] = useState(0);

  // Preview step zone highlight
  const [hoveredPreviewZoneId, setHoveredPreviewZoneId] = useState<string | null>(null);
  const [previewCamId, setPreviewCamId] = useState<string>('');

  // UI
  const [savedToast, setSavedToast] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);

  // Derived
  const activeCamera = cameras.find(c => c.id === selectedCameraIds[0]);
  const activeCamId = selectedCameraIds[activeZoneCamIdx] || selectedCameraIds[0] || '';
  const currentCamZones = multiZones[activeCamId] || [];
  const canSaveZone = newZoneType === 'line' ? drawingPoints.length >= 2 : drawingPoints.length >= 3;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveZone = () => {
    if (!canSaveZone) return;
    // Apply convex hull for zones so stored points are always in correct winding order
    const finalPoints = newZoneType === 'zone' && drawingPoints.length >= 3
      ? convexHull(drawingPoints)
      : [...drawingPoints];
    const newZone: DrawnZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName.trim() || `Vùng ${ZONE_LETTERS[(currentCamZones.length) % 26]}`,
      type: newZoneType,
      role: newZoneRole,
      points: finalPoints,
    };
    setMultiZones(prev => ({ ...prev, [activeCamId]: [...(prev[activeCamId] || []), newZone] }));
    setDrawingPoints([]);
    const nextIdx = (currentCamZones.length + 1) % 26;
    setNewZoneName(`Vùng ${ZONE_LETTERS[nextIdx]}`);
  };

  const handleDeleteZone = (camId: string, zoneId: string) => {
    setMultiZones(prev => ({ ...prev, [camId]: (prev[camId] || []).filter(z => z.id !== zoneId) }));
  };

  const resetBuilderState = () => {
    setEditingPipelineId(null);
    setSelectedCameraIds([]);
    setFlowName('');
    setUserDescription('');
    setRoutedModelName('YOLO-NAS-S');
    setRoutedModelReason('Mặc định');
    setSearchQuery('');
    setCameraSearch('');
    setScheduleSlots([]);
    setNewZoneName('Vùng A');
    setNewZoneType('zone');
    setNewZoneRole('monitor');
    setDetectionTarget('person');
    setCustomTarget('');
    setDetectionRule('enter_area');
    setAlertDuration(10);
    setAlertCount(1);
    setCooldown(60);
    setConfidence(0.65);
    setIou(0.45);
    setTracker('bytetrack');
    setFrameSkip(0);
    setInferenceFps(15);
    setSearchScope('whole_scene');
    setSimilarityThreshold(0.78);
    setRetrievalTopK(5);
    setChannels({ zalo: true, email: false, telegram: false, webhook: false });
    setMultiZones({});
    setDrawingPoints([]);
    setActiveZoneCamIdx(0);
    setGoldenSamples([]);
    setEnableSSIM(true);
    setEnableCNN(false);
    setEnableOCR(false);
    setExpectedOCRText('');
    setDefectSensitivity('medium');
    setInspectionROIs({});
    setZoneCondition('inside');
    setCountingProductImage(null);
    setAiContext({ environment: '', normalBehavior: '', specialNotes: '' });
setSelectedDomain('');
    setSelectedUseCaseDef(null);
    setUseCaseParamValues({});
    setUseCaseImages([]);
    setUseCaseImageROIs({});
    useCaseParamsCache.current = {};
    useCaseImagesCache.current = {};
    useCaseImageROIsCache.current = {};
    userDescriptionCache.current = {};
    smartFlowStateCache.current = {};
    multiZonesCache.current = {};
    drawingPointsCache.current = {};
    setUserDescription('');
    setSmartFlowState('idle');
  };

  const inferMonitoringConfig = (text: string, hasRoi: boolean): InferredMonitoringConfig => {
    const lw = text.toLowerCase();
    const inc = (k: string) => lw.includes(k);

    const hasPpe = ['mũ bảo hộ', 'áo phản quang', 'bảo hộ lao động', 'ppe', 'găng tay', 'khẩu trang', 'giày bảo hộ', 'kính hàn', 'áo choàng', 'kính bảo hộ'].some(inc);
    const hasVehicle = ['ô tô', 'oto', 'xe máy', 'xe tải', 'container', 'biển số', 'xe bọc thép'].some(inc);
    const hasForklift = ['xe nâng', 'forklift'].some(inc);
    const hasPerson = ['người', 'khách', 'nhân viên', 'công nhân', 'bác sĩ', 'học sinh', 'phụ huynh', 'tài xế', 'bảo vệ', 'thợ', 'y tá', 'shipper'].some(inc);
    const asksCount = ['đếm', 'số lượng', 'bao nhiêu', 'thống kê', 'kiểm kê', 'tỷ lệ', 'sĩ số', 'bao nhiêu người'].some(inc);
    const usesLine = ['vào ra', 'ra vào', 'đi qua', 'qua cổng', 'qua vạch', 'lên tầng', 'cross line'].some(inc);
    const usesExit = ['rời khỏi', 'đi ra khỏi', 'rời lớp', 'rời phòng', 'thoát ra', 'trốn khỏi', 'ra cổng'].some(inc);
    const usesIntrusion = ['xâm nhập', 'đi vào', 'vào khu vực', 'leo trèo', 'lẻn vào', 'vượt rào', 'bước vào', 'vào lớp', 'tiến vào', 'leo rào', 'đột nhập'].some(inc);
    const usesLoiter = ['lảng vảng', 'ở lại lâu', 'quá lâu', 'đứng lâu', 'lai vảng', 'dòm ngó', 'theo dõi quanh', 'đứng chờ lâu'].some(inc);
    const hasDefect = ['lỗi', 'móp', 'rách', 'xước', 'hỏng', 'nhãn lệch', 'thiếu linh kiện', 'sai sót', 'rớt', 'nứt', 'kênh', 'lắp ngược', 'lắp sai', 'vết nứt', 'in mờ'].some(inc);
    const hasAbandoned = ['bỏ lại', 'vô chủ', 'balo', 'ba lô', 'vali', 'thùng lạ', 'không ai nhận'].some(inc);
    const hasRemoval = ['lấy mất', 'lấy khỏi', 'bị mất', 'trộm', 'cậy phá', 'gỡ xuống', 'bị dời', 'bị lấy', 'di dời'].some(inc);
    const hasFire = ['khói', 'cháy', 'ngọn lửa', 'tia lửa', 'bốc lửa'].some(inc);
    const hasSmoking = ['hút thuốc', 'điếu thuốc', 'khói thuốc', 'nhả khói'].some(inc);
    const hasPhone = ['điện thoại', 'bấm điện thoại', 'nhìn màn hình'].some(inc);
    const hasFight = ['đánh nhau', 'xô xát', 'bạo lực', 'bạo loạn', 'hỗn chiến', 'ẩu đả', 'bao vây', 'dồn ép', 'trấn lột'].some(inc);
    const hasWrongWay = ['ngược chiều', 'nhầm làn', 'đi ngược', 'sai chiều', 'đi lùi'].some(inc);
    const hasWrongZone = ['sai tuyến', 'sai bãi', 'sai khu vực', 'nhầm tuyến', 'nhầm chỗ', 'để sai', 'xếp nhầm', 'đỗ sai', 'lấn vạch', 'vượt vạch'].some(inc);
    const hasDoorAnomaly = ['cửa mở quá', 'mở lâu', 'bị kẹp mở', 'cậy phá cửa', 'chèn cửa', 'chặn cửa', 'khóa cửa thoát'].some(inc);
    const hasCrowdBlock = ['cản lối thoát', 'chắn thoát hiểm', 'bít lối thoát', 'vật cản thoát hiểm', 'cửa thoát hiểm bị'].some(inc);
    const hasEmptyShelf = ['kệ trống', 'hết hàng', 'thiếu sản phẩm', 'trống chỗ'].some(inc);
    const hasProductivity = ['năng suất', 'nhịp độ', 'thời gian trễ', 'máy dừng', 'băng tải dừng', 'ngừng hoạt động', 'số sản phẩm/giờ'].some(inc);
    const hasProximity = ['lại gần xe nâng', 'đứng sau đuôi', 'bán kính cần cẩu', 'va chạm xe', 'điểm mù'].some(inc);
    const hasHeatmap = ['bản đồ nhiệt', 'heatmap', 'dừng chân', 'điểm nóng', 'khu vực tập trung'].some(inc);
    const hasDemographic = ['nhân khẩu', 'giới tính', 'độ tuổi', 'nam nữ', 'tỷ lệ nam'].some(inc);
    const hasHandHygiene = ['sát khuẩn', 'rửa tay'].some(inc);
    const hasAfterHours = ['ngoài giờ', 'sau giờ làm', 'ban đêm', 'sau 18', 'sau 20', 'sau 22'].some(inc);
    const isUrgent = ['ngay lập tức', 'tức thì', 'khẩn cấp'].some(inc);

    const durMatch = lw.match(/quá\s+(\d+)\s*(phút|giây|tiếng)/);
    const customDuration = durMatch
      ? (durMatch[2] === 'phút' ? Number(durMatch[1]) * 60 : durMatch[2] === 'tiếng' ? Number(durMatch[1]) * 3600 : Number(durMatch[1]))
      : null;

    const isOpenVocab = hasPpe || hasDefect || hasAbandoned || hasRemoval || hasFire || hasSmoking || hasPhone || hasFight
      || hasWrongWay || hasWrongZone || hasDoorAnomaly || hasCrowdBlock || hasEmptyShelf || hasProductivity
      || hasProximity || hasHeatmap || hasDemographic || hasHandHygiene;
    const usesKnownTarget = hasPerson || hasVehicle || hasForklift;

    if (!isOpenVocab && usesKnownTarget) {
      const target = (hasForklift || hasVehicle) ? 'vehicle' : 'person';
      const rule = usesLine ? 'cross_line' : usesExit ? 'exit_area' : usesIntrusion ? 'enter_area'
        : usesLoiter ? 'loitering' : asksCount ? 'object_counting' : 'appear';
      return {
        mode: 'standard', model: 'YOLO-NAS-S', target, rule,
        scope: hasRoi ? 'roi' : 'whole_scene',
        countingType: usesLine ? 'line' : 'zone',
        config: {
          alertDuration: customDuration ?? (usesLoiter ? 60 : hasAfterHours ? 5 : 10),
          alertCount: asksCount ? maxLimit : 0,
          cooldown: isUrgent ? 15 : 60,
          confidence: 0.65, iou: 0.45, tracker: 'bytetrack',
          frameSkip: usesLine ? 0 : 1, inferenceFps: 15,
        },
      };
    }

    const rule = hasPpe ? 'safety_violation'
      : hasDefect ? 'defect_detected'
      : hasAbandoned ? 'abandoned_object'
      : hasRemoval ? 'object_removed'
      : hasFire || hasSmoking ? 'fire_smoke'
      : hasCrowdBlock || hasWrongZone ? 'zone_violation'
      : hasDoorAnomaly ? 'door_anomaly'
      : usesIntrusion ? 'enter_area'
      : usesExit ? 'exit_area'
      : usesLoiter ? 'loitering'
      : asksCount ? 'object_counting'
      : 'semantic_match';

    return {
      mode: 'smart',
      model: hasPpe ? 'YOLO-NAS + LocateAnything (Crop Mode)' : 'LocateAnything-3B',
      rule, scope: hasRoi ? 'roi' : 'whole_scene', countingType: 'zone',
      searchQuery: hasPpe ? 'người không đội mũ bảo hộ, người không mặc áo phản quang' : text,
      config: {
        similarityThreshold: hasDefect ? 0.82 : 0.78,
        retrievalTopK: hasRoi ? 5 : 8,
        cooldown: isUrgent ? 15 : 60,
        alertDuration: customDuration ?? (usesLoiter ? 60 : 10),
        alertCount: asksCount ? maxLimit : 0,
      },
    };
  };

  const analyzePrompt = (text: string) => {
    const lw = text.toLowerCase();
    const findings: string[] = [];
    const add = (msg: string) => { if (!findings.includes(msg)) findings.push(msg); };

    let action = 'giám sát và phân tích';
    let target = 'các đối tượng';
    let location = 'khu vực được chỉ định';
    let time = '';
    let condition = 'nếu có dấu hiệu bất thường';

    // ── Hành vi chính ──
    if (/xâm\s+nhập|đột\s+nhập|leo\s+trèo|lẻn\s+vào|trèo\s+tường|leo\s+rào|vượt\s+rào/.test(lw)) {
      action = 'phát hiện xâm nhập/đột nhập'; add('Hành vi: Xâm nhập / đột nhập / leo rào');
    }
    else if (/lảng\s+vảng|ở\s+lại\s+lâu|dòm\s+ngó|đứng\s+lâu|lai\s+vảng|đứng\s+chờ\s+lâu/.test(lw)) {
      action = 'phát hiện lảng vảng/chờ đợi lâu'; add('Hành vi: Lảng vảng / chờ đợi quá lâu');
    }
    else if (/rời\s+(lớp|phòng|khỏi|khu\s+vực)|đi\s+ra\s+khỏi|thoát\s+ra|ra\s+cổng\s+trong\s+giờ|trốn\s+khỏi/.test(lw)) {
      action = 'phát hiện rời khỏi khu vực'; add('Hành vi: Rời khỏi khu vực');
    }
    else if (/\bđi\s+vào\b|vào\s+khu\s+vực|bước\s+vào|vào\s+lớp|tiến\s+vào/.test(lw)) {
      action = 'phát hiện đi vào khu vực'; add('Hành vi: Đi vào khu vực');
    }
    else if (/đi\s+ngược|ngược\s+chiều|nhầm\s+làn|sai\s+chiều/.test(lw)) {
      action = 'cảnh báo đi ngược chiều/nhầm làn'; add('Hành vi: Ngược chiều / nhầm làn');
    }
    else if (/che\s+(tay|kính\s+camera)|bịt\s+camera|dán\s+băng|xịt\s+sơn|bị\s+bẻ\s+hướng|sai\s+lệch\s+góc/.test(lw)) {
      action = 'phát hiện can thiệp/phá hoại camera'; add('Hành vi: Che / phá hoại camera');
    }
    else if (/bỏ\s+lại|vô\s+chủ|bỏ\s+quên|không\s+ai\s+nhận|thùng\s+lạ|vali\s+vô\s+chủ/.test(lw)) {
      action = 'phát hiện vật thể bỏ lại/vô chủ'; add('Hành vi: Bỏ lại đồ vật / vô chủ');
    }
    else if (/lấy\s+(mất|đi|trộm)|di\s+dời|bị\s+lấy|gỡ\s+xuống|bị\s+dời/.test(lw)) {
      action = 'cảnh báo mất cắp/di dời tài sản'; add('Hành vi: Tài sản bị lấy / di dời');
    }
    else if (/đếm|số\s+lượng|thống\s+kê|kiểm\s+kê|tỷ\s+lệ|sĩ\s+số/.test(lw)) {
      action = 'thống kê số lượng'; add('Hành vi: Đếm / thống kê số lượng');
    }
    else if (/vào\s+ra|ra\s+vào|đi\s+qua|qua\s+vạch|qua\s+cổng/.test(lw)) {
      action = 'giám sát lưu lượng qua ranh giới'; add('Hành vi: Đi qua (vào/ra)');
    }
    else if (/đánh\s+nhau|xô\s+xát|hỗn\s+chiến|ẩu\s+đả|bao\s+vây|dồn\s+ép|trấn\s+lột/.test(lw)) {
      action = 'phát hiện bạo lực/xô xát'; add('Hành vi: Bạo lực / xô xát / trấn lột');
    }
    else if (/tụ\s+tập|đám\s+đông|đông\s+người|ùn\s+tắc|ách\s+tắc|chen\s+lấn/.test(lw)) {
      action = 'phát hiện đám đông/ùn tắc/chen lấn'; add('Hành vi: Đám đông / ùn tắc / chen lấn');
    }
    else if (/tia\s+lửa\s+điện|tia\s+lửa.*tủ/.test(lw)) {
      action = 'phát hiện tia lửa điện bất thường'; add('Hành vi: Tia lửa điện');
    }
    else if (/khói|cháy|ngọn\s+lửa|bốc\s+lửa/.test(lw)) {
      action = 'phát hiện khói/lửa'; add('Hành vi: Cháy nổ / Khói / Lửa');
    }
    else if (/hút\s+thuốc|điếu\s+thuốc|nhả\s+khói\s+thuốc/.test(lw)) {
      action = 'phát hiện hút thuốc'; add('Hành vi: Hút thuốc sai khu vực');
    }
    else if (/điện\s+thoại|bấm\s+điện\s+thoại|nhìn\s+màn\s+hình/.test(lw)) {
      action = 'phát hiện sử dụng điện thoại'; add('Hành vi: Dùng điện thoại trong giờ làm');
    }
    else if (/mũ\s+bảo\s+hộ|áo\s+phản\s+quang|giày\s+bảo\s+hộ|kính\s+hàn|kính\s+bảo\s+hộ|áo\s+choàng\s+cách\s+ly/.test(lw)) {
      action = 'kiểm tra trang bị bảo hộ (PPE)'; add('Hành vi: Không tuân thủ đồ bảo hộ');
    }
    else if (/khẩu\s+trang|đeo\s+khẩu\s+trang|tháo\s+khẩu\s+trang/.test(lw)) {
      action = 'kiểm tra khẩu trang y tế'; add('Hành vi: Không đeo / đeo sai khẩu trang');
    }
    else if (/nhãn\s+lệch|rách\s+bao\s+bì|mã\s+vạch|ocr|in\s+mờ|tem\s+nhãn/.test(lw)) {
      action = 'kiểm tra nhãn mác / đọc mã vạch'; add('Hành vi: Lỗi nhãn / OCR');
    }
    else if (/vượt\s+quá\s+tốc\s+độ|phóng\s+nhanh|chạy\s+quá\s+tốc|tốc\s+độ\s+cao/.test(lw)) {
      action = 'phát hiện vi phạm tốc độ'; add('Hành vi: Chạy quá tốc độ');
    }
    else if (/đỗ\s+(xe\s+)?quá\s+(giờ|lâu|phút)|chiếm\s+dụng.*quá\s+(lâu|giờ)/.test(lw)) {
      action = 'phát hiện đỗ xe quá thời gian'; add('Hành vi: Đỗ xe quá giờ quy định');
    }
    else if (/dừng\s+đỗ\s+trái\s+phép|đỗ\s+sai\s+(quy|vị|khu)|đỗ\s+chiếm|lấn\s+vạch\s+đường/.test(lw)) {
      action = 'phát hiện đỗ xe sai quy định'; add('Hành vi: Dừng đỗ sai quy định / sai khu vực');
    }
    else if (/biển\s+số|ngoại\s+tỉnh|danh\s+sách\s+đen|nhận\s+diện\s+xe/.test(lw)) {
      action = 'nhận diện/kiểm tra biển số xe'; add('Hành vi: Nhận diện biển số xe');
    }
    else if (/cửa.*(mở\s+quá|bị\s+kẹp|không\s+đóng|mở\s+lâu)|cậy\s+phá\s+cửa|chèn\s+cửa|chặn.*cửa/.test(lw)) {
      action = 'phát hiện bất thường cửa'; add('Hành vi: Cửa mở bất thường / cậy phá');
    }
    else if (/mở\s+cửa\s+ngoài\s+giờ|cửa.*sau\s+\d+\s*[hg]/.test(lw)) {
      action = 'phát hiện mở cửa ngoài giờ'; add('Hành vi: Mở cửa ngoài giờ quy định');
    }
    else if (/cản\s+lối\s+thoát|chắn.*thoát\s+hiểm|bít\s+lối\s+thoát|cửa\s+thoát.*bị\s+khóa|vật\s+cản.*thoát/.test(lw)) {
      action = 'phát hiện cản trở lối thoát hiểm'; add('Hành vi: Cản trở / khóa lối thoát hiểm');
    }
    else if (/thiếu\s+linh\s+kiện|lắp\s+ngược|lắp\s+sai|vết\s+nứt|sai\s+sót\s+công\s+đoạn|bỏ\s+qua\s+bước/.test(lw)) {
      action = 'kiểm tra lỗi lắp ráp/quy trình'; add('Hành vi: Lỗi lắp ráp / bỏ qua công đoạn');
    }
    else if (/kệ\s+trống|hết\s+hàng|thiếu\s+sản\s+phẩm.*kệ|trống\s+chỗ.*kệ/.test(lw)) {
      action = 'phát hiện kệ hàng trống'; add('Hành vi: Kệ hàng trống / thiếu sản phẩm');
    }
    else if (/hàng.*rơi|rớt\s+xuống|kiện.*rớt|thùng.*rớt|rơi\s+khỏi\s+băng/.test(lw)) {
      action = 'phát hiện hàng hóa rơi/rớt'; add('Hành vi: Hàng hóa rơi rớt');
    }
    else if (/phân\s+loại\s+nhầm|lẫn\s+vào\s+dây\s+chuyền|màu.*kích\s+thước.*lẫn/.test(lw)) {
      action = 'phát hiện phân loại nhầm hàng'; add('Hành vi: Phân loại nhầm / hàng lẫn');
    }
    else if (/xếp\s+nhầm|để\s+sai\s+(khu\s+vực|bãi|tuyến)|nhầm\s+tuyến|nhầm\s+bãi|sai\s+tuyến/.test(lw)) {
      action = 'phát hiện để sai khu vực/tuyến'; add('Hành vi: Để nhầm khu vực / sai tuyến');
    }
    else if (/xe\s+nâng.*(sai\s+tuyến|khu\s+vực\s+người|cản\s+trở)|đỗ.*cản\s+lối.*kho/.test(lw)) {
      action = 'phát hiện xe nâng vi phạm phân làn'; add('Hành vi: Xe nâng sai tuyến / cản trở lối đi');
    }
    else if (/lùi\s+xe.*nguy\s+hiểm|lùi.*không\s+người\s+xi|lùi.*khu\s+vực\s+khuất|lùi\s+sai\s+cửa/.test(lw)) {
      action = 'phát hiện lùi xe không an toàn'; add('Hành vi: Lùi xe nguy hiểm');
    }
    else if (/xếp\s+chồng.*quá\s+cao|quá\s+cao.*nguy\s+cơ\s+đổ|chồng.*bất\s+thường/.test(lw)) {
      action = 'phát hiện xếp hàng quá cao'; add('Hành vi: Xếp chồng quá cao nguy cơ đổ vỡ');
    }
    else if (/lại\s+gần\s+xe\s+nâng|đứng\s+sau\s+đuôi\s+xe|điểm\s+mù.*xe|bán\s+kính.*cần\s+cẩu/.test(lw)) {
      action = 'phát hiện người tiếp cận nguy hiểm'; add('Hành vi: Người đến gần xe / vùng nguy hiểm');
    }
    else if (/thò\s+tay|chui\s+vào\s+(gầm|máy)|tiến\s+sát\s+lưỡi/.test(lw)) {
      action = 'phát hiện hành vi nguy hiểm gần máy'; add('Hành vi: Thò tay / chui vào máy đang chạy');
    }
    else if (/máy.*dừng|băng\s+tải.*dừng|ngừng\s+hoạt\s+động|dây\s+chuyền.*dừng/.test(lw)) {
      action = 'phát hiện máy móc ngừng hoạt động'; add('Hành vi: Máy / băng tải dừng bất thường');
    }
    else if (/thời\s+gian\s+trễ|nhịp\s+độ|tốc\s+độ\s+làm\s+việc|số\s+sản\s+phẩm.*giờ/.test(lw)) {
      action = 'đo lường năng suất sản xuất'; add('Hành vi: Giám sát năng suất / nhịp độ');
    }
    else if (/vắng\s+mặt.*quầy|không\s+có\s+nhân\s+viên|không\s+đứng\s+đúng\s+vị\s+trí|tụm\s+tụi|túm\s+tụm/.test(lw)) {
      action = 'phát hiện nhân viên vắng mặt/sai vị trí'; add('Hành vi: Nhân viên vắng mặt / tụ tập');
    }
    else if (/vắng\s+mặt|lơ\s+là|quên\s+tắt/.test(lw)) {
      action = 'giám sát nhân sự/thiết bị'; add('Hành vi: Vắng mặt / lơ là / quên tắt thiết bị');
    }
    else if (/phòng\s+họp.*có\s+người|người\s+trong\s+phòng\s+họp|phòng\s+họp.*chưa\s+đặt|quên\s+tắt.*(điện|máy\s+chiếu)|họp\s+quá\s+giờ/.test(lw)) {
      action = 'giám sát tình trạng phòng họp'; add('Hành vi: Sử dụng phòng họp bất thường');
    }
    else if (/bản\s+đồ\s+nhiệt|heatmap|thời\s+gian\s+dừng\s+chân|điểm\s+nóng|góc\s+khuất.*ít\s+người/.test(lw)) {
      action = 'phân tích heatmap / điểm dừng chân'; add('Hành vi: Phân tích heatmap khách hàng');
    }
    else if (/nhân\s+khẩu|giới\s+tính|độ\s+tuổi|tỷ\s+lệ\s+nam\s+nữ/.test(lw)) {
      action = 'phân tích nhân khẩu học'; add('Hành vi: Phân tích nhân khẩu học');
    }
    else if (/sát\s+khuẩn.*không|không.*sát\s+khuẩn|rửa\s+tay.*không|không.*rửa\s+tay|sát\s+khuẩn\s+quá\s+nhanh/.test(lw)) {
      action = 'kiểm tra tuân thủ vệ sinh tay'; add('Hành vi: Không sát khuẩn / rửa tay không đúng');
    }
    else if (/điểm\s+danh|sĩ\s+số|ghi\s+nhận.*học\s+sinh/.test(lw)) {
      action = 'ghi nhận điểm danh / sĩ số'; add('Hành vi: Điểm danh / ghi nhận sĩ số');
    }
    else if (/đi\s+trễ|vào\s+muộn|đến\s+trễ/.test(lw)) {
      action = 'phát hiện đi trễ/vào muộn'; add('Hành vi: Đi trễ / vào lớp muộn');
    }
    else if (/rời\s+lớp\s+sớm|ra\s+khỏi\s+lớp\s+trước|xách\s+cặp\s+đi\s+ra/.test(lw)) {
      action = 'phát hiện rời lớp trước giờ'; add('Hành vi: Rời lớp sớm');
    }
    else if (/trốn\s+học|ra\s+cổng\s+giờ\s+học|trốn.*khuôn\s+viên|núp.*giờ\s+học/.test(lw)) {
      action = 'phát hiện học sinh trốn học'; add('Hành vi: Học sinh trốn học');
    }
    else if (/xếp\s+hàng\s+chờ|hàng\s+đợi\s+(dài|thanh\s+toán)|chờ\s+(quầy|dịch\s+vụ)|đứng\s+chờ\s+quá/.test(lw)) {
      action = 'phát hiện hàng đợi dài'; add('Hành vi: Hàng đợi / xếp hàng chờ lâu');
    }
    else if (/vượt\s+vạch|lấn\s+chiếm|cản\s+lối|bán\s+hàng\s+rong|chiếm\s+vỉa\s+hè/.test(lw)) {
      action = 'phát hiện cản trở/lấn chiếm'; add('Hành vi: Cản trở / lấn chiếm lối đi');
    }
    else if (/ngã|vấp\s+ngã|tai\s+nạn\s+lao\s+động|bị\s+ngã/.test(lw)) {
      action = 'phát hiện té ngã/tai nạn'; add('Hành vi: Té ngã / tai nạn');
    }
    else if (/đi\s+lạc|trẻ\s+em.*khóc|khóc\s+một\s+mình|không\s+có\s+người\s+lớn/.test(lw)) {
      action = 'phát hiện trẻ em đi lạc'; add('Hành vi: Trẻ em đi lạc / khóc một mình');
    }
    else if (/vũ\s+khí|gậy\s+gộc|vật\s+sắc\s+nhọn|dao|cầm\s+gậy/.test(lw)) {
      action = 'phát hiện mang vũ khí'; add('Hành vi: Mang vũ khí / vật sắc nhọn');
    }
    else if (/ho\s+(hắt\s+hơi)?|hắt\s+hơi|tháo.*khẩu\s+trang.*ho/.test(lw)) {
      action = 'giám sát dịch tễ / vệ sinh hô hấp'; add('Hành vi: Ho / hắt hơi / vi phạm phòng dịch');
    }

    // ── Đối tượng giám sát ──
    if (/xe\s+nâng|forklift/.test(lw)) { target = 'xe nâng'; add('Đối tượng: Xe nâng (Forklift)'); }
    else if (/người\s+lạ|kẻ\s+gian|đối\s+tượng\s+khả\s+nghi/.test(lw)) { target = 'đối tượng lạ/khả nghi'; add('Đối tượng: Người lạ / khả nghi'); }
    else if (/bác\s+sĩ|y\s+tá|nhân\s+viên\s+y\s+tế|điều\s+dưỡng/.test(lw)) { target = 'nhân viên y tế'; add('Đối tượng: Nhân viên y tế'); }
    else if (/học\s+sinh|sinh\s+viên/.test(lw)) { target = 'học sinh'; add('Đối tượng: Học sinh'); }
    else if (/phụ\s+huynh/.test(lw)) { target = 'phụ huynh'; add('Đối tượng: Phụ huynh'); }
    else if (/bệnh\s+nhân/.test(lw)) { target = 'bệnh nhân'; add('Đối tượng: Bệnh nhân'); }
    else if (/khách\s+hàng|khách\s+vip|khách/.test(lw)) { target = 'khách hàng'; add('Đối tượng: Khách hàng'); }
    else if (/nhân\s+viên|bảo\s+vệ|công\s+nhân|tài\s+xế|thợ|shipper/.test(lw)) { target = 'nhân sự / nhân viên'; add('Đối tượng: Nhân viên / Công nhân'); }
    else if (/trẻ\s+em/.test(lw)) { target = 'trẻ em'; add('Đối tượng: Trẻ em'); }
    else if (/ô\s+tô|xe\s+tải|container|xe\s+bọc\s+thép/.test(lw)) { target = 'xe ô tô / xe tải'; add('Đối tượng: Ô tô / Xe tải'); }
    else if (/xe\s+máy|motorcycle/.test(lw)) { target = 'xe máy'; add('Đối tượng: Xe máy'); }
    else if (/pallet|kiện\s+hàng|thùng\s+carton|thùng\s+hàng|bao\s+tải/.test(lw)) { target = 'kiện hàng / pallet'; add('Vật thể: Kiện hàng / Pallet'); }
    else if (/vali|túi\s+xách|ba\s+lô|hành\s+lý/.test(lw)) { target = 'hành lý / túi xách'; add('Vật thể: Hành lý / Túi xách'); }
    else if (/laptop|máy\s+tính|máy\s+chiếu|thiết\s+bị\s+điện/.test(lw)) { target = 'thiết bị điện tử'; add('Vật thể: Thiết bị điện tử'); }
    else if (/bình\s+chữa\s+cháy/.test(lw)) { target = 'bình chữa cháy'; add('Vật thể: Bình chữa cháy'); }
    else if (/sản\s+phẩm|chai|lọ|linh\s+kiện|bảng\s+mạch/.test(lw)) { target = 'sản phẩm / linh kiện'; add('Đối tượng: Sản phẩm / Linh kiện'); }
    else if (/kệ\s+hàng|giá\s+kệ|rack/.test(lw)) { target = 'kệ hàng'; add('Vật thể: Kệ hàng'); }
    else if (/xe\s+đẩy|hàng\s+cồng\s+kềnh/.test(lw)) { target = 'xe đẩy / hàng cồng kềnh'; add('Vật thể: Xe đẩy'); }
    else if (/máy\s+ép|lưỡi\s+cưa|cần\s+cẩu|dây\s+chuyền|băng\s+tải/.test(lw)) { target = 'máy móc / thiết bị sản xuất'; add('Vật thể: Máy móc / Dây chuyền'); }
    else if (/rác|phế\s+thải|phế\s+liệu/.test(lw)) { target = 'rác / phế thải'; add('Vật thể: Rác / Phế thải'); }

    // ── Khu vực cụ thể ──
    const places: [RegExp, string, string][] = [
      [/băng\s+chuyền|băng\s+tải|dây\s+chuyền|chuyền\s+sản\s+xuất/, 'dây chuyền / băng tải', 'Khu vực: Dây chuyền sản xuất'],
      [/kho\s+hàng|kho\s+bãi|nhà\s+xưởng|xưởng\s+sản\s+xuất|nhà\s+máy/, 'nhà xưởng / kho hàng', 'Khu vực: Nhà xưởng / Kho'],
      [/dock|cửa\s+bốc\s+dỡ|trạm\s+cân|bãi\s+(xuất|nhập)\s+hàng/, 'dock / cửa bốc dỡ', 'Khu vực: Dock / Trạm bốc dỡ'],
      [/cổng\s+chính|cổng\s+ra|cổng\s+vào|trước\s+cổng|cổng\s+công\s+ty/, 'cổng ra vào', 'Khu vực: Cổng'],
      [/cửa\s+thoát\s+hiểm|lối\s+thoát\s+hiểm/, 'lối thoát hiểm', 'Khu vực: Lối thoát hiểm'],
      [/cửa\s+(kho|phòng\s+server|hàng|khám|sảnh\s+chính)/, 'cửa', 'Khu vực: Cửa'],
      [/tường\s+rào|hàng\s+rào|rào\s+bảo\s+vệ/, 'tường rào / hàng rào', 'Khu vực: Tường rào'],
      [/hầm\s+xe|bãi\s+đỗ\s+xe|bãi\s+gửi\s+xe|nhà\s+xe/, 'bãi đỗ xe / hầm xe', 'Khu vực: Bãi đỗ xe'],
      [/sảnh|lobby|quầy\s+lễ\s+tân|khu\s+vực\s+lễ\s+tân/, 'sảnh / lễ tân', 'Khu vực: Sảnh / Lễ tân'],
      [/hành\s+lang|lối\s+đi\s+nội\s+bộ/, 'hành lang / lối đi', 'Khu vực: Hành lang'],
      [/thang\s+máy|sảnh\s+thang\s+máy/, 'thang máy', 'Khu vực: Thang máy'],
      [/cầu\s+thang\s+(thoát\s+hiểm|bộ)|cầu\s+thang/, 'cầu thang', 'Khu vực: Cầu thang'],
      [/cây\s+atm|khu\s+vực\s+atm/, 'khu vực ATM', 'Khu vực: ATM'],
      [/phòng\s+mổ|buồng\s+bệnh|cách\s+ly|nội\s+tổng\s+hợp|cấp\s+cứu|phòng\s+khám/, 'khu vực y tế', 'Khu vực: Bệnh viện / Y tế'],
      [/lớp\s+học|sân\s+trường|khuôn\s+viên\s+trường|cổng\s+trường/, 'trường học', 'Khu vực: Trường học'],
      [/nhà\s+vệ\s+sinh|toilet/, 'nhà vệ sinh', 'Khu vực: Nhà vệ sinh'],
      [/phòng\s+họp|meeting\s+room/, 'phòng họp', 'Khu vực: Phòng họp'],
      [/kệ\s+hàng|giá\s+kệ|kệ\s+rack/, 'kệ hàng', 'Khu vực: Kệ hàng'],
      [/khu\s+vực\s+(cấm|nguy\s*hiểm|điện\s+cao\s+thế|thi\s+công)|trạm\s+biến\s+áp|công\s+trường/, 'khu vực nguy hiểm / hạn chế', 'Khu vực: Khu hạn chế'],
      [/trạm\s+xăng|cây\s+xăng/, 'trạm xăng', 'Khu vực: Trạm xăng'],
      [/quầy\s+thu\s+ngân|quầy\s+thanh\s+toán|quầy\s+tư\s+vấn|quầy/, 'quầy dịch vụ', 'Khu vực: Quầy / Thu ngân'],
    ];
    for (const [re, loc, label] of places) {
      if (re.test(lw)) { location = loc; add(label); break; }
    }

    // ── Thời gian / điều kiện ──
    if (/ban\s+đêm|buổi\s+tối|đêm\s+khuya/.test(lw)) { time = ' vào ban đêm'; add('Khung giờ: Ban đêm'); }
    else if (/buổi\s+sáng|đầu\s+giờ/.test(lw)) { time = ' vào buổi sáng'; add('Khung giờ: Buổi sáng'); }
    else if (/giờ\s+cao\s+điểm|giờ\s+tan\s+tầm|tan\s+trường|giờ\s+tan\s+học/.test(lw)) { time = ' vào giờ cao điểm'; add('Khung giờ: Giờ cao điểm'); }
    else if (/ngoài\s+giờ\s+(làm|hành\s+chính)|sau\s+giờ\s+làm/.test(lw)) { time = ' ngoài giờ hành chính'; add('Khung giờ: Ngoài giờ làm việc'); }
    else {
      const timeRange = lw.match(/(?:từ|trong\s+khung\s+giờ)\s+(\d+)[:h]?\s*(?:giờ)?\s*(?:đến|->|tới)\s*(\d+)[:h]?\s*(?:giờ)?/);
      if (timeRange) { time = ` ${timeRange[1]}h–${timeRange[2]}h`; add(`Khung giờ: ${timeRange[1]}h – ${timeRange[2]}h`); }
      else {
        const after = lw.match(/sau\s+(\d+)\s*[hg](?:iờ)?/);
        if (after) { time = ` sau ${after[1]}h`; add(`Khung giờ: Sau ${after[1]}h`); }
      }
    }
    if (/tiếng\s+chuông|sau\s+chuông|khi\s+chuông\s+reo|chuông\s+vào\s+lớp/.test(lw)) {
      add('Điều kiện: Sau khi tiếng chuông reo');
    }

    // ── Ngưỡng thời gian (quá N phút/giây) ──
    if (/ngay\s+lập\s+tức|tức\s+thì|khẩn\s+cấp/.test(lw)) {
      condition = 'cảnh báo ngay lập tức'; add('Phản hồi: Cảnh báo ngay lập tức');
    } else {
      const dur = lw.match(/quá\s+(\d+)\s*(phút|giây|tiếng)|liên\s+tục\s+(\d+)\s*(phút|giây)/);
      if (dur) {
        const n = dur[1] ?? dur[3]; const u = dur[2] ?? dur[4];
        condition = `sẽ cảnh báo nếu xảy ra quá ${n} ${u}`; add(`Ngưỡng: Quá ${n} ${u}`);
      } else { condition = 'sẽ tự động ghi nhận và gửi cảnh báo'; }
    }

    const summary = `Hệ thống AI sẽ ${action} đối với ${target} tại ${location}${time}, và ${condition}.`;
    return { summary, findings };
  };

  const handleSmartApply = () => {
    if (!userDescription.trim() || !selectedUseCaseDef) return;
    const inferred = inferMonitoringConfig(userDescription, drawingPoints.length > 0 || currentCamZones.length > 0);
    setRoutedModelName(inferred.model);
    setRoutedModelReason('Tự suy luận từ mô tả.');
    setSearchScope(inferred.scope);
    setDetectionTarget(inferred.target || 'person');
    setDetectionRule(inferred.rule);
    setInferenceFps(Number(inferred.config.inferenceFps || 15));
    setAlertDuration(Number(inferred.config.alertDuration || 10));
    setAlertCount(Number(inferred.config.alertCount || 0));
    setCooldown(Number(inferred.config.cooldown || 60));
    setConfidence(Number(inferred.config.confidence || 0.65));
    setIou(Number(inferred.config.iou || 0.45));

    setAlertCount(Number(inferred.config.alertCount || 0));
    setCooldown(Number(inferred.config.cooldown || 60));
  };

  const applyTemplate = (tpl: any) => {
    handleDescriptionChange(tpl.description || '');
  };

  const hydratePipelineForEdit = (pipe: Pipeline) => {
    setEditingPipelineId(pipe.id);
    setSelectedCameraIds([pipe.cameraId]);
    setFlowName(pipe.name);
    setUserDescription(pipe.description || pipe.searchQuery || '');
    setRoutedModelName(pipe.detectorName || 'Chưa xác định');
    setInputMode(pipe.detectorName === 'Thông minh' ? 'smart' : 'standard');
    setRoutedModelReason('Đã nạp từ luồng hiện có.');
    setSearchQuery(pipe.searchQuery || '');
    setSearchScope(pipe.searchScope || 'whole_scene');
    setScheduleSlots(pipe.scheduleSlots || []);
    setChannels(pipe.alertChannels);

    // Restore zones
    const restoredZones: DrawnZone[] = pipe.countingZones
      .filter(z => z.name !== 'Toàn khung hình')
      .map(z => ({
        id: z.id,
        name: z.name,
        type: z.type,
        role: z.role ?? 'monitor',
        points: z.type === 'line' ? ([z.lineStart, z.lineEnd].filter(Boolean) as { x: number; y: number }[]) : z.points,
      }));
    if (restoredZones.length > 0) setMultiZones({ [pipe.cameraId]: restoredZones });

    // Restore from use case config if available
    if (pipe.config?.useCaseId) {
      const uc = DOMAINS.flatMap(d => d.useCases).find(u => u.id === pipe.config.useCaseId);
      if (uc) {
        const domain = DOMAINS.find(d => d.useCases.some(u => u.id === uc.id));
        if (domain) setSelectedDomain(domain.key);
        setSelectedUseCaseDef(uc);
        setTaskType(uc.taskMapType);
        if (pipe.config?.useCaseParams) {
          const params = pipe.config.useCaseParams as Record<string, string>;
          setUseCaseParamValues(params);
          useCaseParamsCache.current[uc.id] = params;
        }
        if (pipe.config?.useCaseImages) {
          const images = pipe.config.useCaseImages as string[];
          setUseCaseImages(images);
          useCaseImagesCache.current[uc.id] = images;
        }
        if (pipe.config?.useCaseImageROIs) {
          const rois = pipe.config.useCaseImageROIs as Record<number, BoundingBox[]>;
          setUseCaseImageROIs(rois);
          useCaseImageROIsCache.current[uc.id] = rois;
        }
      }
    }

    // Common params
    setAlertDuration(Number(pipe.config?.alertDuration || 10));
    setAlertCount(Number(pipe.config?.alertCount || 0));
    setCooldown(Number(pipe.config?.cooldown || 60));
    setInferenceFps(Number(pipe.config?.inferenceFps || 15));

    if (pipe.monitoringMode === 'defect_detection' || pipe.config?.enableSSIM !== undefined || pipe.config?.goldenSamples) {
      setGoldenSamples((pipe.config?.goldenSamples as unknown) as string[] || []);
      setEnableSSIM(Boolean(pipe.config?.enableSSIM ?? true));
      setEnableCNN(Boolean(pipe.config?.enableCNN ?? false));
      setEnableOCR(Boolean(pipe.config?.enableOCR ?? false));
      setExpectedOCRText(String(pipe.config?.expectedOCRText || ''));
      setDefectSensitivity(pipe.config?.defectSensitivity as 'low' | 'medium' | 'high' || 'medium');
      setInspectionROIs((pipe.config?.inspectionROIs as unknown) as Record<number, BoundingBox[]> || {});
    } else {
      setConfidence(Number(pipe.config?.confidence || 0.65));
      setIou(Number(pipe.config?.iou || 0.45));
      setTracker(String(pipe.config?.tracker || 'bytetrack'));
      setFrameSkip(Number(pipe.config?.frameSkip || 0));
    }
    setCurrentStep('task');
  };

  const handleNext = () => {
    const idx = WIZARD_STEPS.indexOf(currentStep);
    if (idx < WIZARD_STEPS.length - 1) setCurrentStep(WIZARD_STEPS[idx + 1]);
  };

  const handleBack = () => {
    const idx = WIZARD_STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(WIZARD_STEPS[idx - 1]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) { alert('File quá lớn. Vui lòng chọn ảnh dưới 5MB.'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { if (ev.target?.result) setGoldenSamples(prev => [...prev, ev.target!.result as string]); };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeGoldenSample = (index: number) => {
    setGoldenSamples(prev => prev.filter((_, i) => i !== index));
    setInspectionROIs(prev => {
      const next = { ...prev };
      delete next[index];
      const reindexed: Record<number, BoundingBox[]> = {};
      Object.keys(next).forEach(k => { const n = Number(k); reindexed[n > index ? n - 1 : n] = next[n]; });
      return reindexed;
    });
  };

  const handleSave = () => {
    const existing = editingPipelineId ? pipelines.find(p => p.id === editingPipelineId) : undefined;
    const newPipelines = selectedCameraIds.map(cameraId => {
      const cam = cameras.find(c => c.id === cameraId);
      const savedZones = multiZones[cameraId] || [];

      const countingZones: CountingZone[] = savedZones.length > 0
        ? savedZones.map((z, i) => ({
            id: `zone-${Date.now()}-${i}-${cameraId}`,
            name: z.name,
            type: z.type,
            role: z.role ?? 'monitor',
            points: z.type === 'zone' ? z.points : [],
            lineStart: z.type === 'line' && z.points.length >= 2 ? z.points[0] : undefined,
            lineEnd: z.type === 'line' && z.points.length >= 2 ? z.points[z.points.length - 1] : undefined,
            count: 0,
            inCount: z.type === 'line' ? 0 : undefined,
            outCount: z.type === 'line' ? 0 : undefined,
          }))
        : [{ id: `zone-default-${cameraId}`, name: 'Toàn khung hình', type: 'zone' as const, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], count: 0 }];

      let finalConfig: Record<string, any> = {};
      let finalTarget: string | undefined;
      let finalRule = 'semantic_match';

      if (selectedUseCaseDef) {
        finalTarget = useCaseParamValues['target'] || undefined;
        finalRule = useCaseParamValues['rule'] || 'semantic_match';
        finalConfig = {
          ...useCaseParamValues,
          alertDuration, alertCount, cooldown, inferenceFps,
          useCaseId: selectedUseCaseDef.id,
          useCaseName: selectedUseCaseDef.name,
          useCaseParams: Object.keys(useCaseParamValues).length > 0 ? useCaseParamValues : undefined,
          useCaseImages: useCaseImages.length > 0 ? useCaseImages : undefined,
          useCaseImageROIs: Object.keys(useCaseImageROIs).length > 0 ? useCaseImageROIs : undefined,
        };
      } else if (taskType.startsWith('defect_')) {
        finalRule = 'defect_detected';
        finalConfig = {
          goldenSamples: useCaseImages.length > 0 ? useCaseImages : goldenSamples,
          inspectionROIs, enableSSIM, enableCNN, enableOCR, expectedOCRText,
          alertDuration, alertCount, cooldown, inferenceFps,
        };
      } else {
        finalTarget = detectionTarget === 'custom' ? customTarget : detectionTarget;
        finalRule = detectionRule;
        finalConfig = {
          alertDuration, alertCount, cooldown, inferenceFps,
          confidence, iou, tracker, frameSkip,
        };
      }

      return {
        id: editingPipelineId || `pipe-${Date.now()}-${cameraId}`,
        name: flowName.trim() || `Luồng giám sát - ${cam?.name.split(' ')[1] || 'Camera'}`,
        cameraId,
        detectorName: inputMode === 'smart' ? 'Thông minh' : 'Tiêu chuẩn',
        monitoringMode: taskType.startsWith('defect_') ? 'defect_detection' : undefined,
        detectionTarget: finalTarget,
        detectionRule: finalRule,
        searchScope,
        config: finalConfig,
        searchQuery: userDescription || undefined,
        description: userDescription || undefined,
        countingZones,
        alertChannels: channels,
        scheduleSlots: scheduleSlots.length > 0 ? scheduleSlots : undefined,
        isActive: existing?.isActive ?? true,
        createdAt: existing?.createdAt || new Date().toISOString(),
      } as Pipeline;
    });

    setPipelines(prev => {
      if (editingPipelineId) return [...newPipelines, ...prev.filter(p => p.id !== editingPipelineId)];
      return [...newPipelines, ...prev];
    });
    const savedCamId = selectedCameraIds[0];
    setCurrentStep('list');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
    if (onSelectCamera && savedCamId) onSelectCamera(savedCamId);
    resetBuilderState();
  };

  const handleClonePipeline = (pipe: Pipeline) => {
    const cloned: Pipeline = {
      ...pipe,
      id: `pipe-clone-${Date.now()}`,
      name: `${pipe.name} (Bản sao)`,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    setPipelines(prev => [cloned, ...prev]);
  };

  // ── Stepper config ─────────────────────────────────────────────────────────
  const STEP_META = [
    { key: 'camera', label: 'Camera', icon: <CamIcon size={14} /> },
    { key: 'task', label: 'Nghiệp vụ', icon: <FileText size={14} /> },
    { key: 'config', label: 'Cấu hình', icon: <Sliders size={14} /> },
    { key: 'alert', label: 'Báo động', icon: <Bell size={14} /> },
    { key: 'preview', label: 'Triển khai', icon: <Check size={14} /> },
  ];

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden w-full h-full min-h-[calc(100vh-130px)] flex flex-col">
      {savedToast && (
        <div className="fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          ✓ Kích hoạt luồng AI mới thành công!
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner border border-emerald-100">
            <Sparkles size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Trợ lý Cấu hình AI thông minh</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tạo và quản lý các luồng xử lý AI cho hệ thống camera</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      {currentStep !== 'list' && (
        <div className="border-b border-slate-100 px-4 md:px-8 pt-6 pb-4 bg-slate-50/60">
          <div className="relative flex items-start justify-between w-full px-4">
            <div className="absolute left-0 top-4 -translate-y-1/2 w-full h-[3px] bg-slate-200 rounded-full z-0" />
            <div
              className="absolute left-0 top-4 -translate-y-1/2 h-[3px] bg-emerald-500 rounded-full transition-all duration-700 z-0"
              style={{ width: `${(WIZARD_STEPS.indexOf(currentStep) / (WIZARD_STEPS.length - 1)) * 100}%` }}
            />
            {STEP_META.map((s) => {
              const stepIdx = WIZARD_STEPS.indexOf(s.key as Step);
              const curIdx = WIZARD_STEPS.indexOf(currentStep);
              const isCompleted = curIdx > stepIdx;
              const isActive = currentStep === s.key;
              return (
                <div key={s.key} className="relative z-10 flex flex-col items-center w-16">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full transition-all duration-500 shadow-sm ${isCompleted ? 'bg-emerald-600 text-white' : isActive ? 'bg-white border-2 border-emerald-500 text-emerald-600 ring-4 ring-emerald-50' : 'bg-slate-100 border-2 border-slate-200 text-slate-400'}`}>
                    {isCompleted ? <Check size={16} strokeWidth={3} /> : s.icon}
                  </div>
                  <span className={`mt-2 text-[10px] font-bold text-center whitespace-nowrap transition-colors ${isActive ? 'text-emerald-700' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">

        {/* ── LIST ─────────────────────────────────────────────────────────── */}
        {currentStep === 'list' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Luồng giám sát đang hoạt động ({pipelines.length})</h3>
                <p className="text-xs text-slate-500 mt-1">Danh sách các AI Pipeline đang chạy trên hệ thống camera.</p>
              </div>
              <button
                onClick={() => { resetBuilderState(); setCurrentStep('camera'); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Tạo Luồng Mới
              </button>
            </div>

            {pipelines.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Sparkles size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">Chưa có luồng giám sát nào.</p>
                <button onClick={() => { resetBuilderState(); setCurrentStep('camera'); }} className="text-emerald-600 font-bold text-sm mt-3 hover:underline cursor-pointer">Tạo ngay →</button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Trạng thái', 'Luồng giám sát', 'Camera', 'Cấu hình AI', 'FPS', 'Lịch chạy', 'Thao tác'].map((h, i, arr) => (
                          <th key={h} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${i === arr.length - 1 ? 'text-center w-px' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pipelines.map(pipe => {
                        const cam = cameras.find(c => c.id === pipe.cameraId);
                        const schedule = formatScheduleSlots(pipe.scheduleSlots || []);
                        const fps = pipe.config?.inferenceFps ? `${pipe.config.inferenceFps} FPS` : '15 FPS';
                        const usesFullFrame = pipe.countingZones.length === 0 || pipe.countingZones.some(z => z.name === 'Toàn khung hình');
                        return (
                          <tr key={pipe.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${pipe.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                                {pipe.isActive && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                                {pipe.isActive ? 'Đang bật' : 'Đang tắt'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-sm text-slate-800">{pipe.name}</div>
                              {pipe.searchQuery && <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-slate-400">{pipe.searchQuery}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2 text-xs text-slate-600">
                                <CamIcon size={13} className="mt-0.5 shrink-0 text-slate-400" />
                                <div>
                                  <div className="font-medium text-slate-700 truncate max-w-[140px]">{cam?.name || 'Camera'}</div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{cam?.location}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                                <LayoutGrid size={10} /> {usesFullFrame ? 'Toàn khung hình' : `${pipe.countingZones.length} vùng`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 font-medium">{fps}</td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-600">{schedule}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => hydratePipelineForEdit(pipe)} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200" title="Sửa">
                                  <Pencil size={12} /> Sửa
                                </button>
                                <button onClick={() => handleClonePipeline(pipe)} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100" title="Nhân bản">
                                  <Copy size={12} /> Nhân bản
                                </button>
                                <button onClick={() => setPipelines(prev => prev.map(p2 => p2.id === pipe.id ? { ...p2, isActive: !p2.isActive } : p2))} className={`text-[10px] px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${pipe.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                  {pipe.isActive ? 'Tắt' : 'Bật'}
                                </button>
                                <button onClick={() => setPipelines(prev => prev.filter(p2 => p2.id !== pipe.id))} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Xoá">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CAMERA STEP ───────────────────────────────────────────────────── */}
        {currentStep === 'camera' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: camera list */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Chọn camera</h3>
                <p className="text-xs text-slate-500 mt-1">Có thể chọn nhiều camera để áp dụng cùng một luồng AI.</p>
              </div>
              <input
                type="text" value={cameraSearch} onChange={e => setCameraSearch(e.target.value)}
                placeholder="Tìm camera..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {cameras
                  .filter(c => !cameraSearch || c.name.toLowerCase().includes(cameraSearch.toLowerCase()) || c.location.toLowerCase().includes(cameraSearch.toLowerCase()))
                  .map(cam => (
                    <div
                      key={cam.id}
                      onClick={() => setSelectedCameraIds(prev => prev.includes(cam.id) ? prev.filter(id => id !== cam.id) : [...prev, cam.id])}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selectedCameraIds.includes(cam.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedCameraIds.includes(cam.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                        {selectedCameraIds.includes(cam.id) && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedCameraIds.includes(cam.id) ? 'text-emerald-700' : 'text-slate-700'}`}>{cam.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{cam.location} · {cam.site}</p>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>
                  ))}
              </div>
              {selectedCameraIds.length === 0 && (
                <div className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle size={12} /> Vui lòng chọn ít nhất một camera</div>
              )}
              {selectedCameraIds.length > 0 && (
                <div className="text-xs text-emerald-600 font-medium">✓ Đã chọn {selectedCameraIds.length} camera</div>
              )}
            </div>

            {/* Right: camera preview — adaptive for 1 or multiple */}
            <div className="lg:col-span-7">
              {selectedCameraIds.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl aspect-video flex flex-col items-center justify-center text-slate-400 gap-3">
                  <CamIcon size={40} className="opacity-30" />
                  <p className="text-sm font-medium">Chọn camera bên trái để xem preview</p>
                </div>
              ) : selectedCameraIds.length === 1 ? (
                /* ─ Single camera: full preview ─ */
                (() => {
                  const cam = cameras.find(c => c.id === selectedCameraIds[0])!;
                  return (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5 text-white">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-sm">{cam.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">{cam.resolution} · {cam.fps} FPS</span>
                      </div>
                      <div className="relative aspect-video overflow-hidden bg-slate-950">
                        <CameraPreviewBg camType={cam.type} />
                        <div className="absolute inset-0 z-10 pointer-events-none">
                          {cam.type === 'retail' && (<><div className="absolute border-2 rounded-sm" style={{ left: '22%', top: '32%', width: '8%', height: '22%', borderColor: '#10b981', background: '#10b98115' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-emerald-500 text-white">Người 94%</span></div><div className="absolute border-2 rounded-sm" style={{ left: '60%', top: '35%', width: '7%', height: '20%', borderColor: '#10b981', background: '#10b98115' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-emerald-500 text-white">Người 89%</span></div></>)}
                          {cam.type === 'warehouse' && (<div className="absolute border-2 rounded-sm" style={{ left: '30%', top: '50%', width: '14%', height: '12%', borderColor: '#f59e0b', background: '#f59e0b15' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-amber-500 text-white">Xe nâng 96%</span></div>)}
                          {cam.type === 'parking' && (<div className="absolute border-2 rounded-sm" style={{ left: '42%', top: '38%', width: '16%', height: '10%', borderColor: '#f59e0b', background: '#f59e0b15' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-amber-500 text-white">Ô tô 97%</span></div>)}
                          {cam.type === 'conveyor' && (<><div className="absolute border-2 rounded-sm" style={{ left: '30%', top: '38%', width: '8%', height: '8%', borderColor: '#10b981', background: '#10b98115' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-emerald-500 text-white">Hộp 95%</span></div><div className="absolute border-2 rounded-sm" style={{ left: '62%', top: '40%', width: '6%', height: '6%', borderColor: '#ef4444', background: '#ef444415' }}><span className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap bg-rose-500 text-white">Lỗi 81%</span></div></>)}
                        </div>
                        <div className="absolute top-2 left-2 bg-slate-900/80 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 z-20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-4 gap-2">
                        {[['Địa điểm', cam.site], ['Loại môi trường', cam.type], ['Kết nối', cam.kind?.toUpperCase()], ['Độ trễ', `${cam.latency}ms`]].map(([label, val]) => (
                          <div key={label} className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>
                            <span className="text-[11px] font-semibold text-slate-700">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ─ Multi camera: tabbed grid ─ */
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Tab bar */}
                  <div className="bg-slate-900 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {selectedCameraIds.map((camId, idx) => {
                      const cam = cameras.find(c => c.id === camId)!;
                      return (
                        <button
                          key={camId}
                          onClick={() => setPreviewCamIdx(idx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${previewCamIdx === idx ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {cam.name}
                        </button>
                      );
                    })}
                    <span className="ml-auto text-[10px] text-slate-500 flex-shrink-0">{selectedCameraIds.length} camera đã chọn</span>
                  </div>

                  {/* Active camera big preview */}
                  {(() => {
                    const cam = cameras.find(c => c.id === selectedCameraIds[previewCamIdx < selectedCameraIds.length ? previewCamIdx : 0]);
                    if (!cam) return null;
                    return (
                      <>
                        <div className="relative overflow-hidden bg-slate-950" style={{ aspectRatio: '16/9' }}>
                          <CameraPreviewBg camType={cam.type} />
                          <div className="absolute top-2 left-2 bg-slate-900/80 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 z-20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
                          </div>
                          <div className="absolute bottom-2 right-2 bg-slate-900/75 text-white text-[9px] px-2 py-1 rounded-lg z-20">
                            {cam.resolution} · {cam.fps} FPS · {cam.latency}ms
                          </div>
                        </div>
                        {/* Thumbnail strip of other cameras */}
                        {selectedCameraIds.length > 1 && (
                          <div className="flex gap-1.5 p-2 bg-slate-50 border-t border-slate-100 overflow-x-auto scrollbar-none">
                            {selectedCameraIds.map((camId, idx) => {
                              const c = cameras.find(cx => cx.id === camId)!;
                              return (
                                <button
                                  key={camId}
                                  onClick={() => setPreviewCamIdx(idx)}
                                  className={`flex-shrink-0 relative overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${previewCamIdx === idx ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'}`}
                                  style={{ width: 72, height: 42 }}
                                >
                                  <CameraPreviewBg camType={c.type} />
                                  {previewCamIdx === idx && (
                                    <div className="absolute inset-0 bg-emerald-500/20 z-10" />
                                  )}
                                  <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] font-bold text-white bg-slate-900/70 px-1 py-0.5 rounded text-center truncate z-20">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="px-4 py-3 grid grid-cols-4 gap-2 border-t border-slate-100">
                          {[['Địa điểm', cam.site], ['Loại môi trường', cam.type], ['Kết nối', cam.kind?.toUpperCase()], ['Độ trễ', `${cam.latency}ms`]].map(([label, val]) => (
                            <div key={label} className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>
                              <span className="text-[11px] font-semibold text-slate-700">{val}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TASK STEP ─────────────────────────────────────────────────────── */}
        {currentStep === 'task' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-800">Chọn bài toán</h3>
              <p className="text-xs text-slate-500 mt-1">Chọn lĩnh vực và bài toán cụ thể để cấu hình.</p>
            </div>

            
            {/* ── Domain browser ── */}
            <div className="space-y-6">
              {/* Domain strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {DOMAINS.map(domain => {
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  const isActive = selectedDomain === domain.key;
                  return (
                    <button
                      key={domain.key}
                      onClick={() => {
                        setSelectedDomain(isActive ? '' : domain.key);
                        if (isActive || selectedUseCaseDef) {
                          if (selectedUseCaseDef) {
                            useCaseParamsCache.current[selectedUseCaseDef.id] = useCaseParamValues;
                            useCaseImagesCache.current[selectedUseCaseDef.id] = useCaseImages;
                            useCaseImageROIsCache.current[selectedUseCaseDef.id] = useCaseImageROIs;
                          }
                          setSelectedUseCaseDef(null); setUseCaseParamValues({}); setUseCaseImages([]);
                        }
                      }}
                      className={`relative flex items-center p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden group hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${isActive ? `${c.border} bg-white shadow-lg ring-2 ring-offset-1 ${c.text.replace('text-', 'ring-')}` : `bg-white border-slate-200 hover:border-slate-300`}`}
                    >
                      {isActive && <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${c.activeBg}`} />}
                      
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 transition-colors ${isActive ? c.activeBg + ' text-white shadow-inner' : c.bg + ' ' + c.text + ' group-hover:' + c.activeBg + ' group-hover:text-white'}`}>
                        {domain.key === 'security' && <Shield size={20} />}
                        {domain.key === 'traffic' && <Car size={20} />}
                        {domain.key === 'production' && <Cpu size={20} />}
                        {domain.key === 'safety' && <HardHat size={20} />}
                        {domain.key === 'fire' && <Flame size={20} />}
                        {domain.key === 'retail' && <Store size={20} />}
                        {domain.key === 'warehouse' && <Package size={20} />}
                        {domain.key === 'building' && <Building2 size={20} />}
                        {domain.key === 'healthcare' && <Stethoscope size={20} />}
                        {domain.key === 'education' && <GraduationCap size={20} />}
                        {domain.key === 'transport' && <Plane size={20} />}

                      </div>
                      <div className="flex-1 relative z-10">
                        <div className={`font-bold text-sm ${isActive ? c.text : 'text-slate-800'}`}>{domain.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{domain.useCases.length} bài toán</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Use case list */}
              <div className={`transition-all duration-500 overflow-hidden ${selectedDomain ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}>
                {selectedDomain && (() => {
                  const domain = DOMAINS.find(d => d.key === selectedDomain)!;
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  return (
                    <div className={`bg-slate-50 border rounded-3xl p-5 md:p-6 relative overflow-hidden ${c.border.replace('border-', 'border-').replace('200', '100')}`}>
                      {/* Sub-header background element */}
                      <div className={`absolute top-0 left-0 w-full h-32 opacity-10 bg-gradient-to-b from-${domain.color}-500 to-transparent`} />
                      
                      <div className="relative z-10 flex items-center gap-2 mb-5">
                        <span className={`text-sm font-black uppercase tracking-wider ${c.text}`}>{domain.name}</span>
                        <span className="text-sm text-slate-400 font-medium">— Chọn một bài toán cụ thể để cấu hình</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 relative z-10">
                        {domain.useCases.map(uc => {
                          const isSelected = selectedUseCaseDef?.id === uc.id;
                          const hasImage = uc.needsImage;
                          return (
                            <button
                              key={uc.id}
                              onClick={() => {
                                if (selectedUseCaseDef && selectedUseCaseDef.id !== uc.id) {
                                  useCaseParamsCache.current[selectedUseCaseDef.id] = useCaseParamValues;
                                  useCaseImagesCache.current[selectedUseCaseDef.id] = useCaseImages;
                                  useCaseImageROIsCache.current[selectedUseCaseDef.id] = useCaseImageROIs;
                                }
                                setSelectedUseCaseDef(isSelected ? null : uc);
                                setTaskType(uc.taskMapType);
                                if (!isSelected) {
                                  setUseCaseParamValues(useCaseParamsCache.current[uc.id] || {});
                                  setUseCaseImages(useCaseImagesCache.current[uc.id] || []);
                                  setUseCaseImageROIs(useCaseImageROIsCache.current[uc.id] || {});
                                }
                                setMultiZones({});
                                setDrawingPoints([]);
                                setUserDescription('');
                                setSmartFlowState('idle');
                              }}
                              className={`text-left flex flex-col p-4 rounded-2xl border transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${isSelected ? `${c.border} ${c.bg} shadow-md ring-1 ring-offset-0 ${c.text.replace('text-', 'ring-').replace('700', '400')}` : 'bg-white border-slate-200 hover:border-slate-300'}`}
                            >
                              <div className="flex items-start justify-between w-full mb-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? c.activeBg + ' text-white shadow-inner' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                                  {isSelected ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                </div>
                                {hasImage && (
                                  <span className={`text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${isSelected ? 'bg-white/60 ' + c.text : 'bg-slate-100 text-slate-500'}`}>
                                    <CamIcon size={10} /> Cần ảnh mẫu
                                  </span>
                                )}
                              </div>
                              <div className={`text-sm font-bold leading-tight mb-1 ${isSelected ? c.text : 'text-slate-800'}`}>{uc.name}</div>
                              {uc.desc && <p className={`text-[11px] leading-relaxed flex-1 ${isSelected ? c.text.replace('700', '600') : 'text-slate-500'}`}>{uc.desc}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Selected use case chip */}
              <div className={`transition-all duration-300 overflow-hidden ${selectedUseCaseDef ? 'opacity-100 max-h-40 mt-6' : 'opacity-0 max-h-0'}`}>
                {selectedUseCaseDef && (() => {
                  const domain = DOMAINS.find(d => d.useCases.some(u => u.id === selectedUseCaseDef.id));
                  const c = domain ? DOMAIN_COLOR_MAP[domain.color] : DOMAIN_COLOR_MAP['emerald'];
                  return (
                    <div className={`flex items-center gap-4 border rounded-2xl p-4 shadow-sm relative overflow-hidden ${c.bg} ${c.border}`}>
                      <div className={`absolute top-0 left-0 w-1 h-full ${c.activeBg}`} />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.activeBg} text-white shadow-inner`}>
                        <Check size={20} strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${c.text.replace('700', '600')}`}>Đã chọn bài toán</div>
                        <div className={`text-base font-black truncate ${c.text}`}>{selectedUseCaseDef.name}</div>
                      </div>
                      <button onClick={() => {
                        if (selectedUseCaseDef) {
                          useCaseParamsCache.current[selectedUseCaseDef.id] = useCaseParamValues;
                          useCaseImagesCache.current[selectedUseCaseDef.id] = useCaseImages;
                          useCaseImageROIsCache.current[selectedUseCaseDef.id] = useCaseImageROIs;
                        }
                        setSelectedUseCaseDef(null); setUseCaseParamValues({}); setUseCaseImages([]);
                      }} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${c.border} bg-white ${c.text} hover:${c.bg} hover:shadow-sm`}>
                        Thay đổi
                      </button>
                    </div>
                  );
                })()}
              </div>

              {!selectedDomain && (

                <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                  ↑ Chọn lĩnh vực để xem danh sách bài toán
                </div>
              )}
            </div>

            {/* Task name input — always shown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tên tác vụ</label>
              <input
                type="text" value={flowName} onChange={e => setFlowName(e.target.value)}
                placeholder="VD: Chấm công cổng chính, Giám sát kệ hàng A..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>
        )}

        {/* ── CONFIG STEP (merged: mode + params + ROI) ─────────────────────── */}
        {currentStep === 'config' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cấu hình luồng AI</h3>
              <p className="text-xs text-slate-500 mt-1">Chọn công nghệ AI, thiết lập tham số và vẽ vùng giám sát.</p>
            </div>

            {taskType.startsWith('defect_') ? (
              /* ── Defect detection: full width ── */
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-800">Ảnh Tiêu Chuẩn (Golden Samples)</label>
                  {goldenSamples.length > 0 && (
                    <div className="flex flex-col gap-4 mb-4">
                      {goldenSamples.map((imgSrc, idx) => (
                        <ImageRoiDrawer key={idx} imgSrc={imgSrc} rois={inspectionROIs[idx] || []} onChange={(rois) => setInspectionROIs(prev => ({ ...prev, [idx]: rois }))} onRemove={() => removeGoldenSample(idx)} />
                      ))}
                    </div>
                  )}
                  <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                    <input type="file" accept="image/jpeg, image/png" multiple className="hidden" onChange={handleImageUpload} />
                    <div className="text-slate-500 text-sm">Kéo thả hoặc click để tải lên ảnh sản phẩm chuẩn</div>
                    <div className="mt-2 text-xs text-slate-400">Hỗ trợ JPG, PNG (Tối đa 5MB)</div>
                  </label>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-800">Phương pháp kiểm tra</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { key: 'enableSSIM', val: enableSSIM, set: setEnableSSIM, title: 'Kiểm tra Bề mặt', desc: 'Phát hiện xước, sai lệch vị trí nhỏ.' },
                      { key: 'enableCNN', val: enableCNN, set: setEnableCNN, title: 'Kiểm tra Cấu trúc', desc: 'Phát hiện thiếu linh kiện, sai khác lớn.' },
                    ].map(item => (
                      <label key={item.key} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ${item.val ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} className="mt-1" />
                        <div><div className="font-bold text-sm text-slate-800">{item.title}</div><div className="text-xs text-slate-500">{item.desc}</div></div>
                      </label>
                    ))}
                    <div className={`p-3 rounded-xl border-2 ${enableOCR ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={enableOCR} onChange={e => setEnableOCR(e.target.checked)} className="mt-1" />
                        <div><div className="font-bold text-sm text-slate-800">Đọc chữ / Nhãn mác</div><div className="text-xs text-slate-500">Kiểm tra nhãn mác, số Serial.</div></div>
                      </label>
                      {enableOCR && <input type="text" value={expectedOCRText} onChange={e => setExpectedOCRText(e.target.value)} placeholder="Nhập text kỳ vọng..." className="mt-3 w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Mức nhạy</label>
                    <select value={defectSensitivity} onChange={e => setDefectSensitivity(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Số lỗi liên tiếp</label>
                    <input type="number" min="1" value={alertCount} onChange={e => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">FPS xử lý</label>
                    <select value={inferenceFps} onChange={e => setInferenceFps(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      {[1, 5, 10, 15, 25, 30].map(f => <option key={f} value={f}>{f} FPS{f === 15 ? ' (đề xuất)' : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Non-defect: 2-column layout ── */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: params + timing + performance */}
                <div className="lg:col-span-7 space-y-4">

                  {/* ── Mode selector + domain params / smart input ── */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-4 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-700">{selectedUseCaseDef?.name || 'Chưa chọn bài toán'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setInputMode('standard')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${inputMode === 'standard' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}>
                        <FileText size={14} /> Tiêu chuẩn
                      </button>
                      <button onClick={() => setInputMode('smart')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${inputMode === 'smart' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}>
                        <Sparkles size={14} /> Thông minh
                      </button>
                    </div>

                    {inputMode === 'standard' ? (
                      /* ── Standard: direct domain params ── */
                      selectedUseCaseDef && (() => {
                    const uc = selectedUseCaseDef;
                    const domainDef = DOMAINS.find(d => d.useCases.some(u => u.id === uc.id));
                    const c = domainDef ? DOMAIN_COLOR_MAP[domainDef.color] : DOMAIN_COLOR_MAP['emerald'];

                    const renderParam = (param: UCParam) => {
                      if (param.condition && !param.condition(useCaseParamValues)) return null;
                      // Severity/alertLevel params are rendered in the alarm config section
                      if (param.key === 'severity' || param.key === 'alertLevel') return null;
                      const val = useCaseParamValues[param.key] || '';
                      const setVal = (v: string) => setUseCaseParamValues(prev => ({ ...prev, [param.key]: v }));

                      if (param.type === 'zone_hint' || param.type === 'line_hint') {
                        return (
                          <div key={param.key} className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                            <span>{param.type === 'line_hint' ? '╱' : '⬠'}</span>
                            <span className="font-medium text-slate-500">{param.label}</span>
                            <span className="ml-auto text-[9px]">→ vẽ ở bước ROI bên phải</span>
                          </div>
                        );
                      }

                      if (param.type === 'text') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder={param.placeholder} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                        </div>
                      );

                      if (param.type === 'textarea') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <textarea value={val} onChange={e => setVal(e.target.value)} placeholder={param.placeholder} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 resize-none" />
                        </div>
                      );

                      if (param.type === 'number') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <div className="flex items-center gap-2">
                            <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder={param.placeholder} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                            {param.unit && <span className="text-[10px] text-slate-400 whitespace-nowrap">{param.unit}</span>}
                          </div>
                        </div>
                      );

                      if (param.type === 'select') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <select value={val} onChange={e => setVal(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500">
                            <option value="">— Chọn —</option>
                            {(param.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      );

                      if (param.type === 'toggle') return (
                        <div key={param.key}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${val === 'true' ? 'bg-emerald-500' : 'bg-slate-200'}`} onClick={() => setVal(val === 'true' ? 'false' : 'true')}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-xs text-slate-700">{param.label}{param.optional && <span className="text-slate-400 ml-1">(tuỳ chọn)</span>}</span>
                          </label>
                        </div>
                      );

                      if (param.type === 'multicheck') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <div className="flex flex-wrap gap-2">
                            {(param.options || []).map(opt => {
                              const selected = (val || '').split('|').filter(Boolean);
                              const isOn = selected.includes(opt);
                              return (
                                <button key={opt} type="button" onClick={() => {
                                  const next = isOn ? selected.filter(s => s !== opt) : [...selected, opt];
                                  setVal(next.join('|'));
                                }} className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${isOn ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                  {isOn && '✓ '}{opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );

                      if (param.type === 'card2') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{param.label}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(param.options || []).map(opt => (
                              <button key={opt} type="button" onClick={() => setVal(opt)} className={`text-left p-2.5 rounded-xl border-2 cursor-pointer transition-all ${val === opt ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                <p className={`text-[11px] font-bold ${val === opt ? 'text-emerald-700' : 'text-slate-700'}`}>{opt}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );

                      if (param.type === 'card3') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{param.label}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(param.options || []).map(opt => (
                              <button key={opt} type="button" onClick={() => setVal(opt)} className={`text-center p-2.5 rounded-xl border-2 cursor-pointer transition-all ${val === opt ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                <p className={`text-[11px] font-bold ${val === opt ? 'text-emerald-700' : 'text-slate-700'}`}>{opt}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );

                      if (param.type === 'time_range') {
                        const startVal = String(val || '').split('–')[0] || '';
                        const endVal = String(val || '').split('–')[1] || '';
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            <div className="flex items-center gap-2">
                              <input type="text" placeholder="08:00" value={startVal} onChange={e => setVal(`${e.target.value}–${endVal}`)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-center tracking-widest" maxLength={5} />
                              <span className="text-xs text-slate-400">đến</span>
                              <input type="text" placeholder="17:00" value={endVal} onChange={e => setVal(`${startVal}–${e.target.value}`)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-center tracking-widest" maxLength={5} />
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1.5">Định dạng 24h (Ví dụ: 08:30 đến 17:00)</p>
                          </div>
                        );
                      }

                      if (param.type === 'date_range') {
                        const startVal = String(val || '').split('→')[0]?.trim() || '';
                        const endVal = String(val || '').split('→')[1]?.trim() || '';
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            <div className="flex items-center gap-2">
                              <input type="date" value={startVal} onChange={e => setVal(`${e.target.value} → ${endVal}`)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                              <span className="text-xs text-slate-400">đến</span>
                              <input type="date" value={endVal} onChange={e => setVal(`${startVal} → ${e.target.value}`)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                            </div>
                          </div>
                        );
                      }

                      if (param.type === 'slider_pct') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}</label>
                          <div className="flex items-center gap-3">
                            <input type="range" min={5} max={95} step={5} value={val || '30'} onChange={e => setVal(e.target.value)} className="flex-1 accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700 w-10 text-right">{val || 30}%</span>
                          </div>
                        </div>
                      );

                      if (param.type === 'select_text') {
                        const opts = param.options || [];
                        const isCustom = val !== '' && !opts.includes(val) && val !== '__custom__';
                        const dropVal = isCustom ? '__custom__' : val;
                        return (
                          <div key={param.key} className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            <select value={dropVal} onChange={e => setVal(e.target.value === '__custom__' ? '' : e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500">
                              <option value="">— Chọn —</option>
                              {opts.map(o => <option key={o} value={o}>{o}</option>)}
                              <option value="__custom__">Khác (nhập tay)</option>
                            </select>
                            {(dropVal === '__custom__' || isCustom) && (
                              <input type="text" value={isCustom ? val : ''} onChange={e => setVal(e.target.value)} placeholder="Nhập định dạng tuỳ chỉnh…" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                            )}
                          </div>
                        );
                      }

                      if (param.type === 'bbox_per_field') {
                        const fields = (useCaseParamValues['fields'] || '').split('|').filter(Boolean);
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            {fields.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">Chọn các trường thông tin ở trên để hiển thị danh sách cần đánh dấu</p>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                                <p className="text-[10px] text-slate-500">Trên ảnh mẫu bên trên, vẽ bounding box cho từng trường:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {fields.map(f => <span key={f} className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md font-medium">⬚ {f.trim()}</span>)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (param.type === 'bbox_per_part') {
                        const raw = useCaseParamValues['parts'] || '';
                        const parts = raw.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            {parts.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">Nhập danh sách bộ phận ở trên để hiển thị danh sách cần đánh dấu</p>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                                <p className="text-[10px] text-slate-500">Trên ảnh mẫu bên trên, vẽ bounding box cho từng bộ phận:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {parts.map((p: string) => <span key={p} className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md font-medium">⬚ {p}</span>)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (param.type === 'multicheck_dynamic') {
                        const raw = useCaseParamValues[param.sourceKey || ''] || '';
                        const options = raw.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
                        const selected = (val || '').split('|').filter(Boolean);
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                            {options.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">Nhập danh sách bộ phận ở trên trước</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt: string) => {
                                  const isOn = selected.includes(opt);
                                  return (
                                    <button key={opt} type="button" onClick={() => {
                                      const next = isOn ? selected.filter((s: string) => s !== opt) : [...selected, opt];
                                      setVal(next.join('|'));
                                    }} className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${isOn ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}>
                                      {isOn && '⚠ '}{opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (param.type === 'weekly_schedule') {
                        const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
                        // stored as JSON array: [{day, from, to}, ...]
                        let slots: { day: string; from: string; to: string }[] = [];
                        try { slots = JSON.parse(val || '[]'); } catch { slots = []; }
                        const draft = scheduleDraft[param.key] || { day: 'Thứ 2', from: '', to: '' };
                        const setDraft = (patch: Partial<typeof draft>) =>
                          setScheduleDraft(prev => ({ ...prev, [param.key]: { ...draft, ...patch } }));
                        const addSlot = () => {
                          if (!draft.from || !draft.to) return;
                          setVal(JSON.stringify([...slots, { day: draft.day, from: draft.from, to: draft.to }]));
                          setScheduleDraft(prev => ({ ...prev, [param.key]: { day: draft.day, from: '', to: '' } }));
                        };
                        const removeSlot = (i: number) =>
                          setVal(JSON.stringify(slots.filter((_, idx) => idx !== i)));
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                              {param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}
                            </label>
                            {/* Existing slots */}
                            {slots.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {slots.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium px-2.5 py-1 rounded-lg">
                                    <span className="font-bold">{s.day}</span>
                                    <span className="text-amber-500">·</span>
                                    <span className="font-mono">{s.from}–{s.to}</span>
                                    <button type="button" onClick={() => removeSlot(i)} className="text-amber-400 hover:text-rose-500 leading-none cursor-pointer ml-0.5">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Add row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <select value={draft.day} onChange={e => setDraft({ day: e.target.value })}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-amber-400">
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <input type="text" value={draft.from} onChange={e => setDraft({ from: e.target.value })}
                                placeholder="08:00" maxLength={5}
                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono text-center focus:outline-none focus:border-amber-400" />
                              <span className="text-xs text-slate-400">→</span>
                              <input type="text" value={draft.to} onChange={e => setDraft({ to: e.target.value })}
                                placeholder="09:00" maxLength={5}
                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono text-center focus:outline-none focus:border-amber-400" />
                              <button type="button" onClick={addSlot}
                                className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 cursor-pointer whitespace-nowrap">
                                + Thêm
                              </button>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1.5">Trong các khung giờ này hệ thống sẽ bỏ qua cảnh báo</p>
                          </div>
                        );
                      }

                      if (param.type === 'zone_item_mapping') {
                        const zones = (useCaseParamValues['zoneList'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                        const items = (useCaseParamValues['itemType'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                        // stored as JSON: { "Hàng điện tử": ["A1","B2"], ... }
                        let mapping: Record<string, string[]> = {};
                        try { mapping = JSON.parse(val || '{}'); } catch { mapping = {}; }
                        const toggleZone = (item: string, zone: string) => {
                          const cur = mapping[item] || [];
                          const next = cur.includes(zone) ? cur.filter(z => z !== zone) : [...cur, zone];
                          const updated = { ...mapping, [item]: next };
                          setVal(JSON.stringify(updated));
                        };
                        if (zones.length === 0 || items.length === 0) return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}</label>
                            <p className="text-[10px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                              Nhập danh sách khu vực và loại hàng ở trên trước để tạo bảng mapping
                            </p>
                          </div>
                        );
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{param.label}</label>
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                              {/* Header row */}
                              <div className="grid bg-slate-50 border-b border-slate-200" style={{ gridTemplateColumns: `1fr repeat(${zones.length}, minmax(48px, 1fr))` }}>
                                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Loại hàng</div>
                                {zones.map(z => (
                                  <div key={z} className="px-2 py-2 text-[10px] font-bold text-slate-600 text-center border-l border-slate-200">{z}</div>
                                ))}
                              </div>
                              {/* Data rows */}
                              {items.map((item, idx) => (
                                <div key={item} className={`grid items-center ${idx < items.length - 1 ? 'border-b border-slate-100' : ''}`} style={{ gridTemplateColumns: `1fr repeat(${zones.length}, minmax(48px, 1fr))` }}>
                                  <div className="px-3 py-2.5 text-[11px] text-slate-700 font-medium">{item}</div>
                                  {zones.map(zone => {
                                    const checked = (mapping[item] || []).includes(zone);
                                    return (
                                      <div key={zone} className="flex justify-center items-center border-l border-slate-100 py-2">
                                        <button type="button" onClick={() => toggleZone(item, zone)}
                                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white hover:border-emerald-400'}`}>
                                          {checked && <span className="text-[10px] font-bold leading-none">✓</span>}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1.5">Tích vào ô để chỉ định khu vực hợp lệ cho từng loại hàng</p>
                          </div>
                        );
                      }

                      if (param.type === 'time') return (
                        <div key={param.key}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}</label>
                          <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder="08:00" maxLength={5}
                            className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-center tracking-widest" />
                          <p className="text-[9px] text-slate-400 mt-1">Định dạng 24h (VD: 07:30)</p>
                        </div>
                      );

                      if (param.type === 'license_plate_list') {
                        // Vietnamese plate regex:
                        // Car:        29A-123.45 | 51LD-000.01
                        // Motorcycle: 29-AA.123.45 | 51-AB.123.45
                        const VN_PLATE = /^(\d{2}[A-Z]{1,2}-\d{3}\.\d{2}|\d{2}-[A-Z]{2}[\s.]?\d{3}\.\d{2})$/i;
                        const plates = (val || '').split('|').filter(Boolean);
                        const draft = plateDraft[param.key] || '';
                        const errMsg = plateError[param.key] || '';
                        const addPlate = (raw: string) => {
                          const plate = raw.trim().toUpperCase();
                          if (!plate) return;
                          if (!VN_PLATE.test(plate)) {
                            setPlateError(prev => ({ ...prev, [param.key]: `"${plate}" không đúng định dạng biển số Việt Nam` }));
                            return;
                          }
                          if (plates.includes(plate)) {
                            setPlateError(prev => ({ ...prev, [param.key]: 'Biển số này đã có trong danh sách' }));
                            return;
                          }
                          setVal([...plates, plate].join('|'));
                          setPlateDraft(prev => ({ ...prev, [param.key]: '' }));
                          setPlateError(prev => ({ ...prev, [param.key]: '' }));
                        };
                        const removePlate = (p: string) => setVal(plates.filter(x => x !== p).join('|'));
                        return (
                          <div key={param.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              {param.label}{param.optional && <span className="font-normal normal-case text-slate-300 ml-1">(tuỳ chọn)</span>}
                            </label>
                            {plates.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {plates.map(p => (
                                  <span key={p} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                                    {p}
                                    <button type="button" onClick={() => removePlate(p)} className="text-slate-400 hover:text-rose-500 leading-none cursor-pointer">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={draft}
                                onChange={e => { setPlateDraft(prev => ({ ...prev, [param.key]: e.target.value.toUpperCase() })); setPlateError(prev => ({ ...prev, [param.key]: '' })); }}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPlate(draft); } }}
                                placeholder="VD: 29A-123.45 hoặc 51-AB.123.45"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 uppercase"
                              />
                              <button type="button" onClick={() => addPlate(draft)}
                                className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 cursor-pointer whitespace-nowrap">
                                + Thêm
                              </button>
                            </div>
                            {errMsg && <p className="text-[10px] text-rose-500 mt-1">{errMsg}</p>}
                            <p className="text-[9px] text-slate-400 mt-1">Ô tô: <span className="font-mono">29A-123.45</span> · Xe máy: <span className="font-mono">51-AB.123.45</span> · Nhấn Enter để thêm</p>
                          </div>
                        );
                      }

                      return null;
                    };

                    const requiredParams = uc.params.filter(p => !p.optional);
                    const optionalParams = uc.params.filter(p => p.optional);

                    return (
                      <div className={`bg-white border-2 ${c.border} rounded-2xl p-5 shadow-sm space-y-4`}>
                        {/* Header */}
                        <div className={`flex items-center gap-2 pb-3 border-b border-slate-100`}>
                          <div className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${c.badge}`}>{domainDef?.name}</div>
                          <h4 className="text-sm font-bold text-slate-800">{uc.name}</h4>
                        </div>

                        {/* Image upload — for tasks needing reference images (with bounding box drawing) */}
                        {uc.needsImage && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{uc.imageLabel || 'Ảnh mẫu tham chiếu'}{!uc.multipleImages && <span className="font-normal normal-case text-slate-400 ml-1">(tuỳ chọn)</span>}</label>
                            {useCaseImages.length > 0 && (
                              <div className="flex flex-col gap-3 mb-3">
                                {useCaseImages.map((img, idx) => (
                                  <ImageRoiDrawer
                                    key={idx}
                                    imgSrc={img}
                                    rois={useCaseImageROIs[idx] || []}
                                    onChange={(rois) => setUseCaseImageROIs(prev => ({ ...prev, [idx]: rois }))}
                                    onRemove={() => {
                                      setUseCaseImages(prev => prev.filter((_, i) => i !== idx));
                                      setUseCaseImageROIs(prev => {
                                        const next = { ...prev };
                                        delete next[idx];
                                        const reindexed: Record<number, BoundingBox[]> = {};
                                        Object.keys(next).forEach(k => { const n = Number(k); reindexed[n > idx ? n - 1 : n] = next[n]; });
                                        return reindexed;
                                      });
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            <label className="block border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 hover:border-emerald-300 transition-colors cursor-pointer">
                              <input type="file" accept="image/jpeg,image/png" multiple={uc.multipleImages} className="hidden" onChange={(e) => {
                                Array.from(e.target.files || []).forEach((file: File) => {
                                  if (file.size > 5 * 1024 * 1024) { alert('File quá lớn (tối đa 5MB)'); return; }
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if (uc.multipleImages) setUseCaseImages(prev => [...prev, ev.target!.result as string]);
                                    else setUseCaseImages([ev.target!.result as string]);
                                  };
                                  reader.readAsDataURL(file);
                                });
                                e.target.value = '';
                              }} />
                              <Package size={16} className="mx-auto text-slate-300 mb-1.5" />
                              <p className="text-xs text-slate-500">{uc.multipleImages ? 'Upload nhiều ảnh' : 'Upload ảnh mẫu'} · JPG, PNG · Tối đa 5MB</p>
                              {useCaseImages.length > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">Thêm ảnh nữa</p>}
                            </label>
                          </div>
                        )}

                        {/* Required params (spatial zone/line hints are handled by the ROI panel — skip them here) */}
                        {requiredParams.filter(p => p.type !== 'zone_hint' && p.type !== 'line_hint').length > 0 && (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bắt buộc</p>
                            {requiredParams.filter(p => p.type !== 'zone_hint' && p.type !== 'line_hint').map(renderParam)}
                          </div>
                        )}

                        {/* Optional params in collapsible (skip severity/alertLevel params → shown in Alert step) */}
                        {optionalParams.filter(p => p.key !== 'severity' && p.key !== 'alertLevel').length > 0 && (
                          <details className="group">
                            <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                              <ChevronRight size={12} className="group-open:rotate-90 transition-transform flex-shrink-0" />
                              Tham số tuỳ chọn ({optionalParams.filter(p => p.key !== 'severity' && p.key !== 'alertLevel').length})
                              <span className="font-normal normal-case text-slate-300 ml-1">giúp AI chính xác hơn</span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              {optionalParams.filter(p => p.key !== 'severity' && p.key !== 'alertLevel').map(renderParam)}
                            </div>
                          </details>
                        )}

                        {/* Alarm config — severity/alertLevel params */}
                        {uc.params.filter(p => p.key === 'severity' || p.key === 'alertLevel').length > 0 && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
                            <label className="block text-[10px] font-bold text-rose-500 uppercase tracking-wide">Cấu hình báo động</label>
                            {uc.params.filter(p => p.key === 'severity' || p.key === 'alertLevel').map(p => {
                              const val = useCaseParamValues[p.key] || '';
                              const setVal = (v: string) => setUseCaseParamValues(prev => ({ ...prev, [p.key]: v }));
                              return (
                                <div key={p.key}>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{p.label}</label>
                                  <div className="flex gap-2">
                                    {(p.options || ['Thấp', 'Trung bình', 'Cao']).map(opt => (
                                      <button key={opt} type="button" onClick={() => setVal(opt)}
                                        className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-all cursor-pointer ${val === opt
                                          ? opt === 'Cao' ? 'border-rose-500 bg-rose-500 text-white'
                                            : opt === 'Trung bình' ? 'border-amber-400 bg-amber-400 text-white'
                                            : 'border-slate-400 bg-slate-400 text-white'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                                        {opt === 'Cao' ? '🔴' : opt === 'Trung bình' ? '🟡' : '⚪'} {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Tracker selector — standard config */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Thuật toán bám đuổi <span className="font-normal text-slate-400 normal-case">(Tracker)</span></label>
                          <select value={tracker} onChange={e => setTracker(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <option value="bytetrack">ByteTrack — chính xác, nhanh</option>
                            <option value="deepsort">DeepSORT — mượt, tốn hơn</option>
                            <option value="none">Không bám đuổi — nhanh nhất</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()

                      ) : (
                        /* ── Smart: textarea + suggestions + Áp dụng ── */
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mô tả bằng ngôn ngữ tự nhiên</span>
                          </div>
                          <textarea
                            value={userDescription}
                            onChange={e => { setUserDescription(e.target.value); setSmartFlowState('idle'); }}
                            placeholder={TASK_EXAMPLE_PROMPTS[selectedUseCaseDef?.id || ''] || 'VD: "Cảnh báo khi có người xâm nhập khu vực cấm sau 22h"'}
                            className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 resize-none"
                          />
                          {(() => {
                            const suggestions = TASK_SMART_SUGGESTIONS[selectedUseCaseDef?.id || ''];
                            if (!suggestions || suggestions.length === 0) return null;
                            return (
                              <details className="group">
                                <summary className="text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 list-none flex items-center gap-1.5 select-none">
                                  <ChevronRight size={12} className="group-open:rotate-90 transition-transform flex-shrink-0" />
                                  Gợi ý nhanh
                                </summary>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {suggestions.map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => { setUserDescription(s.description); setSmartFlowState('idle'); }}
                                      className={`text-left border p-2.5 rounded-lg transition-all cursor-pointer ${userDescription === s.description ? 'border-emerald-400 bg-emerald-50' : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'}`}
                                    >
                                      <h5 className={`font-bold text-[11px] ${userDescription === s.description ? 'text-emerald-700' : 'text-slate-700'}`}>{s.name}</h5>
                                      <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-2">{s.description}</p>
                                    </button>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                          {/* ── Ảnh tham chiếu (đặt trước preview) ── */}
                          {selectedUseCaseDef && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Ảnh tham chiếu & mô tả
                                <span className="font-normal normal-case text-slate-400 ml-1">(tuỳ chọn — upload ảnh và khoanh vùng kèm mô tả)</span>
                              </label>
                              {useCaseImages.length > 0 && (
                                <div className="flex flex-col gap-3 mb-3">
                                  {useCaseImages.map((img, idx) => (
                                    <ImageRoiDrawer
                                      key={idx}
                                      imgSrc={img}
                                      rois={useCaseImageROIs[idx] || []}
                                      onChange={(rois) => setUseCaseImageROIs(prev => ({ ...prev, [idx]: rois }))}
                                      onRemove={() => {
                                        setUseCaseImages(prev => prev.filter((_, i) => i !== idx));
                                        setUseCaseImageROIs(prev => {
                                          const next = { ...prev };
                                          delete next[idx];
                                          const reindexed: Record<number, BoundingBox[]> = {};
                                          Object.keys(next).forEach(k => { const n = Number(k); reindexed[n > idx ? n - 1 : n] = next[n]; });
                                          return reindexed;
                                        });
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                              <label className="block border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 hover:border-emerald-300 transition-colors cursor-pointer">
                                <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => {
                                  Array.from(e.target.files || []).forEach((file: File) => {
                                    if (file.size > 5 * 1024 * 1024) { alert('File quá lớn (tối đa 5MB)'); return; }
                                    const reader = new FileReader();
                                    reader.onload = (ev) => { setUseCaseImages(prev => [...prev, ev.target!.result as string]); };
                                    reader.readAsDataURL(file);
                                  });
                                  e.target.value = '';
                                }} />
                                <Package size={16} className="mx-auto text-slate-300 mb-1.5" />
                                <p className="text-xs text-slate-500">Upload ảnh tham chiếu · JPG, PNG · Tối đa 5MB</p>
                                {useCaseImages.length > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">Thêm ảnh nữa</p>}
                              </label>
                            </div>
                          )}

                          {/* Smart flow alert thresholds */}
                          {inputMode === 'smart' && !taskType.startsWith('defect_') && (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thời gian xác nhận cảnh báo</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" min={1} value={alertDuration} onChange={e => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                                  <span className="text-xs text-slate-400 whitespace-nowrap">giây</span>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1">Phải diễn ra liên tục bao lâu trước khi báo</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngưỡng số lượng</label>
                                <input type="number" min={0} value={alertCount} onChange={e => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                                <p className="text-[9px] text-slate-400 mt-1">Nhập 0 để bỏ qua. Phát hiện ≥ N đối tượng thì báo</p>
                              </div>
                            </div>
                          )}

                          {/* ── Nút phân tích (idle) ── */}
                          {smartFlowState === 'idle' && userDescription.trim() && (
                            <div className="flex justify-end pt-1">
                              <button onClick={() => setSmartFlowState('preview')} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2">
                                <Activity size={13} /> Phân tích yêu cầu
                              </button>
                            </div>
                          )}

                          {/* ── Preview: text + ảnh tham chiếu ── */}
                          {smartFlowState === 'preview' && userDescription.trim() && (() => {
                            const { summary, findings } = analyzePrompt(userDescription);
                            const hasRoi = drawingPoints.length > 0 || currentCamZones.length > 0;
                            const inferred = inferMonitoringConfig(userDescription, hasRoi);
                            const RULE_LABELS: Record<string, string> = {
                              enter_area: 'Phát hiện đi vào vùng',
                              exit_area: 'Phát hiện rời khỏi vùng',
                              loitering: 'Lảng vảng / ở lại quá lâu',
                              cross_line: 'Vượt qua đường ranh giới',
                              object_counting: 'Đếm số lượng',
                              appear: 'Xuất hiện đối tượng',
                              safety_violation: 'Vi phạm an toàn lao động (PPE)',
                              defect_detected: 'Phát hiện lỗi sản phẩm',
                              abandoned_object: 'Vật bỏ lại / vô chủ',
                              object_removed: 'Đồ vật bị lấy đi',
                              fire_smoke: 'Phát hiện khói / lửa / hút thuốc',
                              zone_violation: 'Vi phạm khu vực / sai tuyến',
                              door_anomaly: 'Bất thường cửa ra vào',
                              semantic_match: 'Nhận diện ngữ nghĩa tự do',
                            };
                            const ruleLabel = RULE_LABELS[inferred.rule] ?? inferred.rule;
                            const hasImages = useCaseImages.length > 0;
                            if (findings.length === 0 && !hasImages) {
                              return (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px] text-amber-800 mt-2">
                                  Không tìm thấy thông tin cấu hình rõ ràng từ mô tả. Bạn có muốn áp dụng cấu hình mặc định?
                                  <div className="flex items-center justify-end pt-2 gap-2 mt-2 border-t border-amber-200/50">
                                    <button onClick={() => setSmartFlowState('idle')} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer">
                                      Chỉnh sửa mô tả
                                    </button>
                                    <button onClick={() => { handleSmartApply(); setSmartFlowState('applied'); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2">
                                      <Check size={13} /> Vẫn áp dụng
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 mt-2 shadow-inner shadow-emerald-100/50">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                                  <Activity size={14} /> AI đã phân tích bài toán của bạn như sau:
                                </div>

                                {/* Summary từ text */}
                                <div className="text-[13px] text-emerald-900 font-medium leading-relaxed bg-emerald-100/50 p-3 rounded-lg border border-emerald-200">
                                  {summary}
                                </div>

                                {/* Ảnh tham chiếu trong preview */}
                                {hasImages && (
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                      <Package size={11} />
                                      {useCaseImages.length} ảnh tham chiếu sẽ được đưa vào phân tích:
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                      {useCaseImages.map((img, idx) => {
                                        const roiCount = (useCaseImageROIs[idx] || []).length;
                                        return (
                                          <div key={idx} className="relative group">
                                            <img src={img} alt={`ref-${idx}`} className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-200 shadow-sm" />
                                            {roiCount > 0 && (
                                              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                                                {roiCount}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {Object.values(useCaseImageROIs).some((r: BoundingBox[]) => r.length > 0) && (
                                      <p className="text-[10px] text-emerald-600">· Có vùng khoanh — AI sẽ tập trung vào khu vực được đánh dấu</p>
                                    )}
                                  </div>
                                )}

                                {/* Findings từ text */}
                                {findings.length > 0 && (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">AI nhận diện được từ mô tả:</div>
                                      <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">{ruleLabel}</span>
                                    </div>
                                    <ul className="space-y-1.5 bg-white p-3 rounded-lg border border-emerald-100/60 shadow-sm">
                                      {findings.map((f, i) => (
                                        <li key={i} className="text-[12px] text-slate-700 flex items-start gap-2">
                                          <span className="text-emerald-500 mt-0.5">▸</span>
                                          {f}
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}

                                <p className="text-[11px] text-slate-500 italic">Nếu cấu hình chưa đúng, hãy chỉnh mô tả hoặc thêm/sửa ảnh tham chiếu, hoặc chuyển sang chế độ Tiêu chuẩn.</p>
                                <div className="flex items-center justify-end pt-2 gap-2 mt-2 border-t border-emerald-100">
                                  <button onClick={() => setSmartFlowState('idle')} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg transition-colors cursor-pointer">
                                    Nhập lại
                                  </button>
                                  <button onClick={() => { handleSmartApply(); setSmartFlowState('applied'); }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-sm shadow-emerald-200">
                                    <Check size={13} /> Xác nhận áp dụng
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* ── Applied ── */}
                          {smartFlowState === 'applied' && userDescription.trim() && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold">
                                <Check size={14} /> Đã áp dụng cấu hình từ mô tả{useCaseImages.length > 0 ? ` + ${useCaseImages.length} ảnh tham chiếu` : ''}
                              </div>
                              <button onClick={() => setSmartFlowState('idle')} className="text-[10px] text-emerald-600 hover:text-emerald-800 underline cursor-pointer">
                                Thay đổi
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  {/* Performance presets */}
                  {(() => {
                    const PRESETS = [
                      {
                        id: 'economy' as const,
                        emoji: '🌿',
                        label: 'Tiết kiệm tài nguyên',
                        subtitle: 'Phù hợp server yếu hoặc nhiều camera',
                        bullets: ['Kiểm tra mỗi ~5 giây', 'Ít tốn CPU & RAM', 'Phát hiện chậm hơn một chút'],
                        fps: 5, confidence: 0.70, iou: 0.50, tracker: 'none', frameSkip: 2,
                      },
                      {
                        id: 'balanced' as const,
                        emoji: '⚡',
                        label: 'Cân bằng',
                        subtitle: 'Đề xuất cho hầu hết trường hợp',
                        bullets: ['Phát hiện trong ~1 giây', 'CPU vừa phải', 'Độ chính xác cao'],
                        fps: 15, confidence: 0.65, iou: 0.45, tracker: 'bytetrack', frameSkip: 0,
                        recommended: true,
                      },
                      {
                        id: 'precise' as const,
                        emoji: '🎯',
                        label: 'Chính xác tối đa',
                        subtitle: 'Cần server mạnh, ít camera',
                        bullets: ['Phát hiện gần như tức thì', 'Bám theo đối tượng mượt mà', 'Yêu cầu GPU tốt'],
                        fps: 30, confidence: 0.55, iou: 0.35, tracker: 'bytetrack', frameSkip: 0,
                      },
                    ];
                    const applyPreset = (p: typeof PRESETS[number]) => {
                      setPerfPreset(p.id);
                      setInferenceFps(p.fps);
                      setConfidence(p.confidence);
                      setIou(p.iou);
                      setTracker(p.tracker);
                      setFrameSkip(p.frameSkip);
                    };
                    const active = PRESETS.find(p => p.id === perfPreset) || PRESETS[1];
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-amber-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tốc độ xử lý AI</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {PRESETS.map(p => (
                            <button
                              key={p.id}
                              onClick={() => applyPreset(p)}
                              className={`relative text-left rounded-xl border-2 p-3 transition-all cursor-pointer group ${perfPreset === p.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            >
                              {p.recommended && (
                                <span className="absolute -top-2 right-2 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Đề xuất</span>
                              )}
                              <div className="text-xl mb-1.5">{p.emoji}</div>
                              <div className={`text-xs font-bold mb-0.5 ${perfPreset === p.id ? 'text-emerald-800' : 'text-slate-700'}`}>{p.label}</div>
                              <div className="text-[10px] text-slate-400 mb-2">{p.subtitle}</div>
                              <ul className="space-y-0.5">
                                {p.bullets.map(b => (
                                  <li key={b} className={`text-[10px] flex items-start gap-1 ${perfPreset === p.id ? 'text-emerald-700' : 'text-slate-500'}`}>
                                    <span className="mt-px">·</span>{b}
                                  </li>
                                ))}
                              </ul>
                            </button>
                          ))}
                        </div>

                        {/* Active preset summary chip */}
                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-600">
                          <span className="font-bold text-slate-700">{active.emoji} {active.label}</span>
                          <span className="text-slate-300">|</span>
                          <span>{active.fps} FPS</span>
                          <span className="text-slate-300">·</span>
                          <span>Độ nhạy {Math.round(active.confidence * 100)}%</span>
                          {active.tracker !== 'none' && <><span className="text-slate-300">·</span><span>Bám đối tượng: Bật</span></>}
                        </div>


                        {/* Collapsible advanced */}
                        <details className="group" open={showAdvancedPerf} onToggle={e => setShowAdvancedPerf((e.target as HTMLDetailsElement).open)}>
                          <summary className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wide cursor-pointer hover:text-slate-600 list-none select-none">
                            <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                            Tùy chỉnh nâng cao
                            <span className="font-normal normal-case text-slate-300 ml-1">(dành cho kỹ thuật viên)</span>
                          </summary>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">FPS xử lý</label>
                              <select value={inferenceFps} onChange={e => { setInferenceFps(Number(e.target.value)); setPerfPreset('balanced'); }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                {[1, 5, 10, 15, 20, 25, 30].map(f => <option key={f} value={f}>{f} FPS{f === 15 ? ' ★' : ''}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Ngưỡng tin cậy <span className="font-normal text-slate-400 normal-case">(Confidence)</span></label>
                              <div className="flex items-center gap-2">
                                <input type="range" min={0.3} max={0.95} step={0.05} value={confidence} onChange={e => setConfidence(Number(e.target.value))} className="flex-1 accent-emerald-600" />
                                <span className="text-xs font-bold text-slate-700 w-9 text-right">{Math.round(confidence * 100)}%</span>
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-300 mt-0.5"><span>Báo nhiều</span><span>Báo chắc chắn</span></div>
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })()}
                </div>

                {/* Right: ROI drawing */}
                {(() => {
                  const activeZoneCam = cameras.find(c => c.id === activeCamId);
                  return (
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Vùng giám sát (ROI)</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Click để vẽ điểm · Lưu để thêm nhiều vùng</p>
                  </div>

                  {/* Camera tab switcher — shown above canvas, visible regardless of count */}
                  {selectedCameraIds.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedCameraIds.map((camId, idx) => {
                        const cam = cameras.find(c => c.id === camId);
                        const zoneCount = (multiZones[camId] || []).length;
                        return (
                          <button
                            key={camId}
                            onClick={() => { setActiveZoneCamIdx(idx); setDrawingPoints([]); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${activeZoneCamIdx === idx ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cam?.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {cam?.name}
                            {zoneCount > 0 && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeZoneCamIdx === idx ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                {zoneCount} vùng
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Canvas — background follows active camera tab */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700" style={{ aspectRatio: '16/9' }}>
                    {activeZoneCam && <CameraPreviewBg camType={activeZoneCam.type} />}
                    <ZoneOverlay zones={currentCamZones} drawingPoints={drawingPoints} newZoneType={newZoneType} />
                    {/* Clickable layer */}
                    <svg
                      className="absolute inset-0 w-full h-full z-20 cursor-crosshair"
                      viewBox="0 0 1000 562.5"
                      preserveAspectRatio="xMidYMid meet"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        setDrawingPoints(prev => [...prev, { x, y }]);
                      }}
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] px-3 py-1 rounded-full pointer-events-none z-30 whitespace-nowrap">
                      {newZoneType === 'line' ? '⊢ Vẽ 2+ điểm cho vạch · click để thêm điểm' : '⬠ Vẽ 3+ điểm cho vùng · click để thêm điểm'}
                    </div>
                  </div>

                  {/* Zone type + role + controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                      <button onClick={() => { setNewZoneType('zone'); setDrawingPoints([]); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${newZoneType === 'zone' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>⬠ Vùng</button>
                      <button onClick={() => { setNewZoneType('line'); setDrawingPoints([]); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${newZoneType === 'line' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>╱ Vạch</button>
                    </div>
                    {/* Zone role — distinguishes AI monitoring zones from allowed/exception zones */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                      <button onClick={() => setNewZoneRole('monitor')} title="AI giám sát trong vùng này" className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${newZoneRole === 'monitor' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🔴 Giám sát</button>
                      <button onClick={() => setNewZoneRole('exclude')} title="AI bỏ qua / cho phép trong vùng này" className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${newZoneRole === 'exclude' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>✅ Ngoại lệ</button>
                    </div>
                    <input
                      type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                      placeholder="Tên vùng..."
                      className="flex-1 min-w-[100px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                    <button onClick={() => setDrawingPoints(prev => prev.slice(0, -1))} disabled={drawingPoints.length === 0} title="Hoàn tác" className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-sm">↩</button>
                    <button onClick={() => setDrawingPoints([])} disabled={drawingPoints.length === 0} title="Xóa bản vẽ" className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                      <X size={13} />
                    </button>
                    <button
                      onClick={handleSaveZone}
                      disabled={!canSaveZone}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus size={12} /> Lưu vùng
                    </button>
                  </div>

                  {/* Zone list */}
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {currentCamZones.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Chưa có vùng nào. Vẽ và nhấn "Lưu vùng" để thêm.
                        <br /><span className="text-[10px] text-slate-300">(Nếu không vẽ → giám sát toàn khung hình)</span>
                      </div>
                    ) : (
                      currentCamZones.map((z, idx) => {
                        const dotColor = z.role === 'exclude' ? '#22c55e' : ZONE_COLORS[idx % ZONE_COLORS.length];
                        return (
                        <div key={z.id} className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                          <span className="text-xs font-bold text-slate-700 flex-1">{z.name}</span>
                          {z.role === 'exclude' && <span className="text-[9px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">Ngoại lệ</span>}
                          <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded">{z.type === 'line' ? 'Vạch' : 'Vùng'}</span>
                          <button onClick={() => handleDeleteZone(activeCamId, z.id)} className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer p-0.5">
                            <X size={13} />
                          </button>
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── ALERT STEP ────────────────────────────────────────────────────── */}
        {currentStep === 'alert' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cấu hình ngưỡng phát sinh cảnh báo và kênh nhận thông báo</h3>
            </div>

            {/* ── Smart flow: 3 threshold params ── */}
            {inputMode === 'smart' && !taskType.startsWith('defect_') && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-emerald-600" />
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ngưỡng cảnh báo — Luồng thông minh</label>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      <span className="text-xs text-slate-400 whitespace-nowrap">giây</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Chờ bao lâu trước khi cho phép báo tiếp</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Standard flow: alertParams from use case definition ── */}
            {inputMode === 'standard' && selectedUseCaseDef && (() => {
              const alertParamsList = selectedUseCaseDef.alertParams ?? [];
              const hasCooldown = alertParamsList.some(p => p.key === 'cooldownSeconds' || p.key === 'cooldownInterval');
              const totalParams = alertParamsList.length + (hasCooldown ? 0 : 1);
              const renderAlertParam = (param: UCParam) => {
                const val = useCaseAlertParamValues[param.key] || '';
                const setVal = (v: string) => setUseCaseAlertParamValues(prev => ({ ...prev, [param.key]: v }));
                return (
                  <div key={param.key}>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                      {param.label}{param.optional && <span className="font-normal text-slate-400 ml-1 normal-case">(tùy chọn)</span>}
                    </label>
                    {param.type === 'number' && (
                      <div className="flex items-center gap-2">
                        <input type="number" value={val} onChange={e => setVal(e.target.value)}
                          placeholder={param.placeholder || ''}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                        {param.unit && <span className="text-xs text-slate-400 whitespace-nowrap">{param.unit}</span>}
                      </div>
                    )}
                    {param.type === 'slider_pct' && (
                      <div className="flex items-center gap-2">
                        <input type="range" min="0" max="100" value={val || 50} onChange={e => setVal(e.target.value)}
                          className="flex-1 accent-emerald-500" />
                        <span className="text-xs text-slate-600 font-bold min-w-[3ch]">{val || 50}%</span>
                      </div>
                    )}
                    {(param.type === 'select' || param.type === 'select_text') && (
                      <select value={val} onChange={e => setVal(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500">
                        <option value="">-- Chọn --</option>
                        {param.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {(param.type === 'text' || param.type === 'textarea') && (
                      <input type="text" value={val} onChange={e => setVal(e.target.value)}
                        placeholder={param.placeholder || ''}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                    )}
                    {param.type === 'toggle' && (
                      <button
                        onClick={() => setVal(val === 'true' ? 'false' : 'true')}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${val === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    )}
                  </div>
                );
              };
              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-emerald-600" />
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cấu hình ngưỡng cảnh báo — Luồng tiêu chuẩn</label>
                  </div>
                  <div
                    className={totalParams > 1 ? 'grid gap-3' : 'space-y-3'}
                    style={totalParams > 1 ? { gridTemplateColumns: `repeat(${totalParams}, minmax(0, 1fr))` } : undefined}
                  >
                    {alertParamsList.map(renderAlertParam)}
                    {!hasCooldown && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">Khoảng thời gian nhận cảnh báo 1 lần</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={useCaseAlertParamValues['cooldownInterval'] || ''}
                            onChange={e => setUseCaseAlertParamValues(prev => ({ ...prev, cooldownInterval: e.target.value }))}
                            placeholder="60"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500" />
                          <span className="text-xs text-slate-400 whitespace-nowrap">giây/phút</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'zalo', icon: <MessageSquare size={20} />, label: 'Popup', desc: 'Hiển thị cảnh báo trực tiếp trên giao diện' },
                { key: 'email', icon: <Mail size={20} />, label: 'Email', desc: 'Gửi ảnh và thông tin sự kiện qua email' },
                { key: 'webhook', icon: <Webhook size={20} />, label: 'Webhook', desc: 'Gửi sự kiện sang hệ thống bên ngoài' },
              ].map(ch => (
                <label key={ch.key} className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${channels[ch.key as keyof typeof channels] ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">{ch.icon}</div>
                    <div><h4 className="font-semibold text-xs text-slate-800">{ch.label}</h4><p className="text-[10px] text-slate-400">{ch.desc}</p></div>
                  </div>
                  <input type="checkbox" checked={channels[ch.key as keyof typeof channels]} onChange={() => setChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key as keyof typeof channels] }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </label>
              ))}
              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between bg-slate-50/50 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-200 text-slate-500 rounded-xl"><Send size={20} /></div>
                  <div><h4 className="font-semibold text-xs text-slate-800">Telegram Bot</h4><p className="text-[10px] text-slate-400">Chưa được cấu hình</p></div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-1 rounded">Chưa cấu hình</span>
              </div>
            </div>

            {/* ── Schedule ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock size={12} /> Lịch chạy
                </label>
                <button
                  onClick={() => {
                    if (scheduleSlots.length === 0) {
                      setScheduleSlots([{ id: Date.now().toString(), days: ['T2','T3','T4','T5','T6'], start: '08:00', end: '18:00' }]);
                    } else {
                      setScheduleSlots([]);
                    }
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${scheduleSlots.length === 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${scheduleSlots.length === 0 ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {scheduleSlots.length === 0 ? (
                <p className="text-xs text-slate-400">AI chạy liên tục 24/7 — không giới hạn ngày hay giờ.</p>
              ) : (
                <div className="space-y-3">
                  {scheduleSlots.map((slot, idx) => (
                    <div key={slot.id} className="bg-slate-50 rounded-xl p-3 space-y-2.5 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Khung {idx + 1}</span>
                        {scheduleSlots.length > 1 && (
                          <button onClick={() => setScheduleSlots(prev => prev.filter(s => s.id !== slot.id))} className="text-slate-300 hover:text-rose-400 transition-colors">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {/* Day pills */}
                      <div className="flex gap-1.5 flex-wrap">
                        {ALL_DAYS.map(day => {
                          const selected = slot.days.includes(day);
                          return (
                            <button
                              key={day}
                              onClick={() => setScheduleSlots(prev => prev.map(s => s.id !== slot.id ? s : {
                                ...s,
                                days: selected ? s.days.filter(d => d !== day) : [...s.days, day]
                              }))}
                              className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${selected ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'}`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      {/* Time range */}
                      <div className="flex items-center gap-2">
                        <input
                          type="time" value={slot.start}
                          onChange={e => setScheduleSlots(prev => prev.map(s => s.id !== slot.id ? s : { ...s, start: e.target.value }))}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-slate-400 text-xs">→</span>
                        <input
                          type="time" value={slot.end}
                          onChange={e => setScheduleSlots(prev => prev.map(s => s.id !== slot.id ? s : { ...s, end: e.target.value }))}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setScheduleSlots(prev => [...prev, { id: Date.now().toString(), days: ['T2','T3','T4','T5','T6'], start: '08:00', end: '18:00' }])}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all cursor-pointer"
                  >
                    <Plus size={12} /> Thêm khung giờ khác
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PREVIEW STEP ─────────────────────────────────────────────────── */}
        {currentStep === 'preview' && (() => {
          // For preview, pick the displayed camera (allow switching when multi-cam)
          const pvCamId = previewCamId && selectedCameraIds.includes(previewCamId)
            ? previewCamId : selectedCameraIds[0] || '';
          const pvCam = cameras.find(c => c.id === pvCamId);
          const pvZones = multiZones[pvCamId] || [];
          const isMultiCam = selectedCameraIds.length > 1;
          const hasZones = pvZones.length > 0;

          // ── Problem statement generator ──────────────────────────────────
          const generateProblemStatement = (): string => {
            const scheduleDesc = scheduleSlots.length === 0 ? '24/7' : formatScheduleSlots(scheduleSlots);
            const pvZonesHere = multiZones[pvCamId] || [];
            const monitorZones = pvZonesHere.filter(z => (z.role ?? 'monitor') === 'monitor');
            const excludeZones = pvZonesHere.filter(z => z.role === 'exclude');
            const zoneDesc = pvZonesHere.length > 0
              ? `tại ${monitorZones.length > 0 ? `${monitorZones.length} vùng giám sát (${monitorZones.map(z => z.name).join(', ')})` : 'toàn bộ khung hình'}` +
                (excludeZones.length > 0 ? `, bỏ qua ${excludeZones.length} vùng ngoại lệ (${excludeZones.map(z => z.name).join(', ')})` : '')
              : 'toàn bộ khung hình';

            if (selectedUseCaseDef) {
              const baseDesc = userDescription.trim() || selectedUseCaseDef.name || 'giám sát theo nghiệp vụ';
              return `AI thực hiện ${baseDesc} ${zoneDesc}. Hệ thống chạy ${scheduleDesc}, xác nhận sự kiện sau ${alertDuration}s và nghỉ ${cooldown}s giữa các cảnh báo liên tiếp.`;
            }

            if (taskType.startsWith('defect_')) {
              const methods = [enableSSIM && 'kiểm tra bề mặt (MS-SSIM + FSIM)', enableCNN && 'đặc trưng ngữ nghĩa (DINOv2)', enableOCR && 'đọc nhãn mác (PaddleOCR)'].filter(Boolean).join(', ');
              return `AI so sánh sản phẩm thực tế với ${goldenSamples.length > 0 ? `${goldenSamples.length} ảnh mẫu chuẩn` : 'ảnh mẫu (chưa upload)'} sử dụng ${methods || 'kiểm tra bề mặt mặc định'}. Mỗi sản phẩm được phân tích tại ${inferenceFps} FPS và nhận phán quyết OK/NG theo ngưỡng đã cấu hình.`;
            }

            const baseDesc = userDescription.trim() || 'giám sát theo yêu cầu người dùng';
            return `AI sẽ ${baseDesc} ${zoneDesc}. Hệ thống chạy ${scheduleDesc}, xác nhận sự kiện sau ${alertDuration}s và nghỉ ${cooldown}s giữa các cảnh báo liên tiếp.`;
          };

          // Resolve input mode for display
          const displayMode = inputMode === 'smart' ? 'Thông minh' : 'Tiêu chuẩn';

          return (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800">Xem trước & Triển khai</h3>
                <p className="text-xs text-slate-500 mt-1">Kiểm tra cấu hình luồng trước khi kích hoạt AI.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: camera + interactive zone preview */}
                <div className="lg:col-span-7 space-y-2">

                  {/* Camera tab switcher (multi-cam) */}
                  {isMultiCam && (
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedCameraIds.map(camId => {
                        const c = cameras.find(cx => cx.id === camId);
                        const zCount = (multiZones[camId] || []).length;
                        return (
                          <button
                            key={camId}
                            onClick={() => { setPreviewCamId(camId); setHoveredPreviewZoneId(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${pvCamId === camId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${c?.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {c?.name}
                            {zCount > 0 && <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${pvCamId === camId ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{zCount} vùng</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Camera + zone SVG */}
                  <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                    <div className="bg-slate-800 px-4 py-3 flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-bold text-sm text-white">{pvCam?.name || 'Camera chưa chọn'}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{pvCam?.resolution} · {pvCam?.fps} FPS</span>
                    </div>
                    <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      {pvCam ? <CameraPreviewBg camType={pvCam.type} /> : <div className="absolute inset-0 bg-slate-800" />}

                      {/* Interactive zone SVG */}
                      <svg
                        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                        viewBox="0 0 1000 562.5"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <defs>
                          {pvZones.map((z, idx) => {
                            const color = z.role === 'exclude' ? '#22c55e' : ZONE_COLORS[idx % ZONE_COLORS.length];
                            return (
                              <filter key={`glow-${z.id}`} id={`glow-${z.id}`} x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feFlood floodColor={color} floodOpacity="0.6" result="color" />
                                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                                <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
                              </filter>
                            );
                          })}
                        </defs>

                        {pvZones.map((z, idx) => {
                          const color = z.role === 'exclude' ? '#22c55e' : ZONE_COLORS[idx % ZONE_COLORS.length];
                          const isExclude = z.role === 'exclude';
                          const isHovered = hoveredPreviewZoneId === z.id;
                          const isAnyHovered = hoveredPreviewZoneId !== null;
                          // Dim non-focused zones; highlight focused
                          const opacity = isAnyHovered ? (isHovered ? 1 : 0.2) : 0.85;
                          const strokeWidth = isHovered ? 3.5 : 2;
                          const filterAttr = isHovered ? `url(#glow-${z.id})` : undefined;

                          if (z.type === 'line' && z.points.length >= 2) {
                            const p0 = z.points[0], p1 = z.points[z.points.length - 1];
                            const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
                            return (
                              <g key={z.id} opacity={opacity} filter={filterAttr}>
                                <line x1={`${p0.x}%`} y1={`${p0.y}%`} x2={`${p1.x}%`} y2={`${p1.y}%`}
                                  stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                                  strokeDasharray={isExclude ? '8 4' : (isHovered ? 'none' : '10 5')} />
                                <circle cx={`${mx}%`} cy={`${my}%`} r="14" fill={color} />
                                <text x={`${mx}%`} y={`${my}%`} fill="white" fontSize="11" fontWeight="bold"
                                  textAnchor="middle" dominantBaseline="middle">{isExclude ? '✓' : idx + 1}</text>
                                <rect x={`${mx + 2}%`} y={`${my - 4}%`}
                                  width={`${Math.max(z.name.length * 1.4, 8)}%`} height="5%"
                                  rx="4" fill={`${color}dd`} />
                                <text x={`${mx + 2 + Math.max(z.name.length * 0.7, 4)}%`} y={`${my}%`}
                                  fill="white" fontSize="10" fontWeight="bold"
                                  textAnchor="middle" dominantBaseline="middle">{z.name}</text>
                              </g>
                            );
                          }

                          if (z.type === 'zone' && z.points.length >= 3) {
                            const cx = z.points.reduce((s, p) => s + p.x, 0) / z.points.length;
                            const cy = z.points.reduce((s, p) => s + p.y, 0) / z.points.length;
                            return (
                              <g key={z.id} opacity={opacity} filter={filterAttr}>
                                <polygon
                                  points={z.points.map(p => `${p.x * 10} ${p.y * 5.625}`).join(' ')}
                                  fill={`${color}${isHovered ? '33' : '20'}`}
                                  stroke={color}
                                  strokeWidth={strokeWidth}
                                  strokeLinejoin="round"
                                  strokeDasharray={isExclude ? '8 4' : (isHovered ? 'none' : undefined)}
                                />
                                <circle cx={`${cx}%`} cy={`${cy}%`} r="14" fill={color} />
                                <text x={`${cx}%`} y={`${cy}%`} fill="white" fontSize="11" fontWeight="bold"
                                  textAnchor="middle" dominantBaseline="middle">{isExclude ? '✓' : idx + 1}</text>
                                <rect x={`${cx - Math.max(z.name.length * 0.7, 4)}%`} y={`${cy + 4}%`}
                                  width={`${Math.max(z.name.length * 1.4, 8)}%`} height="5%"
                                  rx="4" fill={`${color}dd`} />
                                <text x={`${cx}%`} y={`${cy + 6.5}%`} fill="white" fontSize="10" fontWeight="bold"
                                  textAnchor="middle" dominantBaseline="middle">{z.name}</text>
                              </g>
                            );
                          }
                          return null;
                        })}
                      </svg>

                      <div className="absolute top-2 left-2 bg-slate-900/80 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 z-30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE · AI ON
                      </div>
                      {!hasZones && (
                        <div className="absolute bottom-2 right-2 bg-slate-900/75 text-slate-300 text-[9px] px-2 py-0.5 rounded z-30">Toàn khung hình</div>
                      )}
                    </div>
                  </div>

                  {/* Interactive zone legend */}
                  {hasZones ? (
                    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vùng cấu hình</span>
                        <span className="text-[10px] text-slate-500">Di chuột để xem từng vùng</span>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {pvZones.map((z, idx) => {
                          const isExclude = z.role === 'exclude';
                          const color = isExclude ? '#22c55e' : ZONE_COLORS[idx % ZONE_COLORS.length];
                          const isHovered = hoveredPreviewZoneId === z.id;
                          return (
                            <div
                              key={z.id}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-default transition-colors ${isHovered ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                              onMouseEnter={() => setHoveredPreviewZoneId(z.id)}
                              onMouseLeave={() => setHoveredPreviewZoneId(null)}
                            >
                              {/* Color + role badge */}
                              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm"
                                style={{ background: color }}>
                                {isExclude ? '✓' : idx + 1}
                              </div>
                              {/* Color stripe — dashed for exclude */}
                              <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isExclude ? 'opacity-60' : ''}`} style={{ background: color }} />
                              {/* Name + role type */}
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs font-bold ${isHovered ? 'text-white' : 'text-slate-300'}`}>{z.name}</span>
                                <span className={`ml-2 text-[10px] ${isExclude ? 'text-green-500' : 'text-slate-500'}`}>
                                  {isExclude ? '✓ Ngoại lệ (AI bỏ qua)' : (z.type === 'line' ? 'Vạch kiểm soát' : 'Vùng giám sát')}
                                </span>
                              </div>
                              {isHovered && (
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-2.5">
                      <LayoutGrid size={14} className="text-slate-500 flex-shrink-0" />
                      <p className="text-xs text-slate-400">Không có vùng cụ thể — AI sẽ giám sát <strong className="text-slate-200">toàn bộ khung hình</strong></p>
                    </div>
                  )}
                </div>

                {/* Right: config summary card */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-emerald-600 px-5 py-4">
                      <h4 className="font-black text-white text-base">{flowName.trim() || 'Luồng giám sát mới'}</h4>
                      <p className="text-emerald-100 text-xs mt-0.5">{TASK_LABELS[taskType] || taskType}</p>
                    </div>
                    <div className="p-5 space-y-3">
                      {[
                        { icon: <CamIcon size={13} />, label: 'Camera', value: isMultiCam ? `${selectedCameraIds.length} camera (${selectedCameraIds.map(id => cameras.find(c => c.id === id)?.name?.split(' ')[0]).join(', ')})` : pvCam?.name || '—' },

                        { icon: <LayoutGrid size={13} />, label: 'Vùng giám sát', value: hasZones ? `${pvZones.length} vùng` : 'Toàn khung hình' },
                        { icon: <Zap size={13} />, label: 'Tốc độ xử lý', value: `${inferenceFps} FPS · Độ nhạy ${Math.round(confidence * 100)}%` },
                        { icon: <Clock size={13} />, label: 'Lịch chạy', value: formatScheduleSlots(scheduleSlots) },
                        { icon: <Bell size={13} />, label: 'Thông báo', value: [channels.zalo && 'Popup', channels.email && 'Email', channels.webhook && 'Webhook'].filter(Boolean).join(', ') || 'Không gửi' },
                      ].map(row => (
                        <div key={row.label} className="flex items-start gap-3">
                          <span className="text-slate-400 flex-shrink-0 mt-0.5">{row.icon}</span>
                          <span className="text-xs text-slate-500 w-24 flex-shrink-0 pt-px">{row.label}</span>
                          <span className="text-xs font-semibold text-slate-800 flex-1">{row.value}</span>
                        </div>
                      ))}
                      {userDescription && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase">Mô tả yêu cầu</p>
                          <p className="text-xs text-slate-700 italic line-clamp-3">"{userDescription}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── AI Config Detail Card ── */}
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                      <Cpu size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cấu hình AI</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      {/* Model */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Chế độ</span>
                        <span className="text-[11px] font-semibold text-slate-800">{displayMode}</span>
                      </div>

                      {/* Performance preset */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Hiệu năng</span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {perfPreset === 'economy' ? 'Tiết kiệm' : perfPreset === 'precise' ? 'Chính xác' : 'Cân bằng'}
                          <span className="text-slate-400 font-normal"> · {inferenceFps} FPS</span>
                        </span>
                      </div>

                      {/* Use case params summary */}
                      {selectedUseCaseDef && (
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0 pt-px">Nghiệp vụ</span>
                          <span className="text-[11px] font-semibold text-slate-800">{selectedUseCaseDef.name}</span>
                        </div>
                      )}

                      {/* Description */}
                      {userDescription && (
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0 pt-px">Mô tả</span>
                          <span className="text-[11px] font-semibold text-slate-800 line-clamp-2">{userDescription}</span>
                        </div>
                      )}

                      {/* Defect: samples + features */}
                      {taskType.startsWith('defect_') && (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Ảnh mẫu</span>
                            <span className="text-[11px] font-semibold text-slate-800">
                              {goldenSamples.length > 0 ? `${goldenSamples.length} ảnh` : <span className="text-rose-400">Chưa upload</span>}
                            </span>
                          </div>
                          {(enableOCR || enableCNN) && (
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Tính năng</span>
                              <span className="text-[11px] font-semibold text-slate-800">
                                {[enableOCR && 'OCR', enableCNN && 'CNN'].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Alert thresholds */}
                      <div className="pt-2.5 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ngưỡng cảnh báo</p>
                        <div className="flex gap-5 flex-wrap">
                          <div>
                            <p className="text-[9px] text-slate-400">Tiếp diễn tối thiểu</p>
                            <p className="text-xs font-bold text-slate-700">{alertDuration}s</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400">Tạm ngưng sau báo</p>
                            <p className="text-xs font-bold text-slate-700">{cooldown}s</p>
                          </div>
                          {!taskType.startsWith('defect_') && maxLimit > 0 && (
                            <div>
                              <p className="text-[9px] text-slate-400">Giới hạn số lượng</p>
                              <p className="text-xs font-bold text-slate-700">&gt; {maxLimit}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-cam zone summary */}
                  {isMultiCam && (
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Vùng theo từng camera</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {selectedCameraIds.map(camId => {
                          const cam = cameras.find(c => c.id === camId);
                          const zones = multiZones[camId] || [];
                          return (
                            <div key={camId} className="flex items-center gap-3 px-4 py-2.5">
                              <CamIcon size={12} className="text-slate-300 flex-shrink-0" />
                              <span className="text-xs font-medium text-slate-700 flex-1 truncate">{cam?.name}</span>
                              {zones.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  {zones.map((z, idx) => (
                                    <span key={z.id} className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center"
                                      style={{ background: ZONE_COLORS[idx % ZONE_COLORS.length] }}>{idx + 1}</span>
                                  ))}
                                  <span className="ml-1 text-[10px] text-slate-400">{zones.length} vùng</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">Toàn khung hình</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Problem Statement Card ── */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                      <FileText size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phát biểu bài toán</span>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-slate-300 leading-relaxed">{generateProblemStatement()}</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">Luồng AI sẽ được kích hoạt ngay sau khi nhấn <strong>Lưu & Triển khai</strong>. Bạn có thể tắt/bật hoặc chỉnh sửa bất kỳ lúc nào.</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-8 py-4 bg-slate-50/60 flex items-center justify-between mt-auto">
        {currentStep === 'list' ? (
          <div className="w-full flex justify-end">
            <button onClick={onComplete} className="bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer">Đóng</button>
          </div>
        ) : (
          <>
            <button
              onClick={() => currentStep === 'camera' ? setCurrentStep('list') : handleBack()}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer bg-white"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>
            {currentStep === 'preview' ? (
              <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer">
                <Check size={15} /> Lưu & Triển khai AI
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={(currentStep === 'camera' && selectedCameraIds.length === 0) || (currentStep === 'task' && !selectedUseCaseDef)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
