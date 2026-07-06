import React, { useState, Dispatch, SetStateAction } from 'react';
import { Camera, Pipeline, CountingZone, AlertRule, ScheduleSlot } from '../types';
import { PIPELINE_TEMPLATES } from '../mockData';
import {
  Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft,
  MessageSquare, Send, Mail, Webhook, FileText, Clock, ChevronRight, Trash2, Pencil,
  X, LayoutGrid, Shield, BarChart3, HardHat, Flame, Car, Package, Tag, Bug, Search,
  Activity, Store, Sparkles, Plus, Copy, Zap, Wifi, Monitor, Usb
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
    { id: 'lo4', name: 'Theo dõi quanh xe chở tiền', description: 'Báo động khi có đối tượng lai vãng quanh xe bọc thép chở tiền' },
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
    { id: 'bpd1', name: 'Mật độ khu vực sảnh', description: 'Đo lường mức độ đông đúc tại sảnh chính toà nhà' },
    { id: 'bpd2', name: 'Sử dụng khu sinh hoạt chung', description: 'Theo dõi tỷ lệ lấp đầy tại hành lang hoặc pantry' },
    { id: 'bpd3', name: 'Mật độ nhà ăn/Canteen', description: 'Cảnh báo khi canteen toà nhà có dấu hiệu quá tải giờ nghỉ trưa' },
    { id: 'bpd4', name: 'Tắc nghẽn sảnh chờ', description: 'Đánh giá không gian trống còn lại tại khu vực tiếp khách' },
  ],
  hc_patient_escape: [
    { id: 'hc_pe1', name: 'Giám sát cổng ra', description: 'Cảnh báo khi bệnh nhân rời khỏi cổng bệnh viện' },
    { id: 'hc_pe2', name: 'Bệnh nhân nhi đi lạc', description: 'Phát hiện trẻ em rời khỏi khu vực khoa nhi không có người lớn đi kèm' },
    { id: 'hc_pe3', name: 'Rời khu vực cách ly', description: 'Cảnh báo khẩn khi bệnh nhân truyền nhiễm tự ý mở cửa ra ngoài' },
    { id: 'hc_pe4', name: 'Bệnh nhân tâm thần', description: 'Giám sát chặt chẽ hành lang, báo động nếu bệnh nhân tiếp cận lối thoát hiểm' },
  ],
  hc_restricted: [
    { id: 'hc_res1', name: 'Kho thuốc / Dược phẩm', description: 'Phát hiện người lạ vào kho thuốc ngoài giờ hành chính' },
    { id: 'hc_res2', name: 'Kho vật tư y tế', description: 'Cảnh báo xâm nhập kho chứa trang thiết bị y tế đắt tiền' },
    { id: 'hc_res3', name: 'Phòng lưu trữ hồ sơ', description: 'Báo động nếu có người không phận sự tiếp cận phòng hồ sơ bệnh án' },
    { id: 'hc_res4', name: 'Khu xử lý rác y tế', description: 'Giám sát khu vực lưu giữ rác thải nguy hại để tránh người lạ tiếp cận' },
  ],
  hc_crowd_restricted: [
    { id: 'hc_cr1', name: 'Phòng hồi sức', description: 'Cảnh báo khi có quá nhiều người tụ tập trước phòng hồi sức' },
    { id: 'hc_cr2', name: 'Khu vực cấp cứu', description: 'Phát hiện ùn ứ người nhà bệnh nhân tại hành lang khu cấp cứu' },
    { id: 'hc_cr3', name: 'Khu vực phẫu thuật', description: 'Báo động nếu có hơn 2 người không phận sự đứng trước cửa phòng mổ' },
    { id: 'hc_cr4', name: 'Hành lang cách ly', description: 'Cảnh báo đám đông tụ tập ở hành lang gần khu vực bệnh truyền nhiễm' },
  ],
  edu_escape: [
    { id: 'edu_e1', name: 'Trốn học', description: 'Phát hiện học sinh trèo tường hoặc rời khỏi trường trong giờ học' },
    { id: 'edu_e2', name: 'Rời lớp sớm', description: 'Cảnh báo khi học sinh rời khỏi khu vực lớp học khi chưa có chuông báo' },
    { id: 'edu_e3', name: 'Khu vực sân sau', description: 'Giám sát góc khuất sân trường, phát hiện học sinh lẻn ra ngoài bằng cổng phụ' },
    { id: 'edu_e4', name: 'Khu nội trú', description: 'Cảnh báo học sinh tự ý rời khỏi ký túc xá sau giờ giới nghiêm' },
  ],
  edu_cheating: [
    { id: 'edu_c1', name: 'Dùng điện thoại', description: 'Phát hiện học sinh sử dụng điện thoại trong phòng thi' },
    { id: 'edu_c2', name: 'Trao đổi tài liệu', description: 'Phát hiện hành vi quay cóp, trao đổi bài trong giờ kiểm tra' },
    { id: 'edu_c3', name: 'Hành vi ngoái nhìn', description: 'Cảnh báo khi thí sinh liên tục quay ngang, ngoái lại nhìn bài người khác' },
    { id: 'edu_c4', name: 'Sử dụng tài liệu', description: 'Phát hiện hành vi giấu và lật giở tài liệu dưới gầm bàn' },
  ],
  edu_weapons: [
    { id: 'edu_w1', name: 'Phát hiện dao/gậy', description: 'Cảnh báo ngay lập tức nếu phát hiện vật sắc nhọn hoặc gậy gộc' },
    { id: 'edu_w2', name: 'Mang theo súng', description: 'Nhận diện hình ảnh vũ khí sát thương cao trong khuôn viên trường' },
    { id: 'edu_w3', name: 'Vật liệu cháy nổ', description: 'Cảnh báo phát hiện bom xăng, chai lọ chứa chất gây cháy' },
    { id: 'edu_w4', name: 'Hung khí tự chế', description: 'Phát hiện học sinh giấu hung khí tự chế trong balo hoặc áo khoác' },
  ],
  ap_abandoned_baggage: [
    { id: 'ap_ab1', name: 'Hành lý bỏ quên', description: 'Cảnh báo vali hoặc túi xách để quá 5 phút tại sảnh chờ' },
    { id: 'ap_ab2', name: 'Gói hàng khả nghi', description: 'Phát hiện thùng carton bị vứt lại ở góc khuất nhà vệ sinh' },
    { id: 'ap_ab3', name: 'Túi xách trên xe đẩy', description: 'Cảnh báo hành lý bị bỏ quên trên xe đẩy tại khu vực bãi đỗ xe' },
    { id: 'ap_ab4', name: 'Vật thể tại băng chuyền', description: 'Phát hiện hành lý nằm trên băng chuyền quá 3 vòng không ai nhận' },
  ],
  ap_restricted: [
    { id: 'ap_res1', name: 'Xâm nhập khu vực cấm', description: 'Cảnh báo người lạ đi vào khu vực đường băng hoặc khoang hành lý' },
    { id: 'ap_res2', name: 'Khu soi chiếu an ninh', description: 'Phát hiện người chưa qua kiểm tra cố tình lẻn qua cửa an ninh' },
    { id: 'ap_res3', name: 'Khu vực đỗ máy bay', description: 'Báo động khi có nhân sự không mặc áo phản quang vào khu vực đỗ' },
    { id: 'ap_res4', name: 'Phòng kiểm soát không lưu', description: 'Cảnh báo lập tức khi có người không phận sự tiếp cận tháp điều khiển' },
  ],
  ap_baggage_carousel: [
    { id: 'ap_bc1', name: 'Kẹt hành lý', description: 'Phát hiện tình trạng ùn ứ hành lý trên băng chuyền' },
    { id: 'ap_bc2', name: 'Trèo lên băng chuyền', description: 'Cảnh báo hành vi nguy hiểm trèo lên băng chuyền' },
    { id: 'ap_bc3', name: 'Hành lý ngoại cỡ', description: 'Phát hiện hành lý quá to, có nguy cơ gây kẹt hệ thống' },
    { id: 'ap_bc4', name: 'Hành lý bị rơi rớt', description: 'Cảnh báo vali bị rơi vãi, rớt ra ngoài khu vực chuyển tải' },
  ],
  ap_weapon: [
    { id: 'ap_w1', name: 'Phát hiện súng', description: 'Cảnh báo khẩn cấp khi phát hiện người mang súng vào sảnh' },
    { id: 'ap_w2', name: 'Phát hiện dao/kiếm', description: 'Nhận diện người cầm theo vũ khí sắc nhọn tiến về khu check-in' },
    { id: 'ap_w3', name: 'Vũ khí trong hành lý', description: 'Phối hợp camera soi chiếu, phát hiện hình dáng vũ khí giấu kín' },
    { id: 'ap_w4', name: 'Mang theo gậy gộc', description: 'Phát hiện người có biểu hiện bạo lực mang theo gậy bóng chày, tuýp sắt' },
  ],
  ap_safety_line: [
    { id: 'ap_sl1', name: 'Lấn vạch an toàn', description: 'Báo động khi hành khách lấn qua vạch vàng lúc tàu chuẩn bị đến' },
    { id: 'ap_sl2', name: 'Trẻ em đùa nghịch', description: 'Cảnh báo hành vi chạy nhảy sát mép đường ray' },
    { id: 'ap_sl3', name: 'Người ngã xuống rãnh', description: 'Cảnh báo khẩn khi có người rơi xuống khu vực đường ray' },
    { id: 'ap_sl4', name: 'Hành lý lấn vạch', description: 'Phát hiện vali bị đẩy ra quá sát mép bến xe/tàu điện' },
  ],
  bld_restricted: [
    { id: 'br1', name: 'Khu vực máy chủ', description: 'Báo động nếu có người không phận sự vào phòng server' },
    { id: 'br2', name: 'Kho tài liệu mật', description: 'Phát hiện người lạ lẻn vào phòng lưu trữ hồ sơ quan trọng' },
    { id: 'br3', name: 'Phòng kỹ thuật điện', description: 'Cảnh báo nhân viên không chuyên môn tiếp cận tủ điện tổng' },
    { id: 'br4', name: 'Lối đi nội bộ VIP', description: 'Phát hiện người sử dụng trái phép hành lang dành riêng cho ban lãnh đạo' },
  ],
  hc_fall: [
    { id: 'hf1', name: 'Phòng bệnh nhân', description: 'Phát hiện bệnh nhân ngã xuống sàn trong phòng điều trị' },
    { id: 'hf2', name: 'Ngã trong nhà vệ sinh', description: 'Cảnh báo khẩn cấp nếu có người trượt ngã tại nhà vệ sinh' },
    { id: 'hf3', name: 'Ngã tại cầu thang', description: 'Phát hiện người cao tuổi, bệnh nhân vấp ngã khu vực bậc thang' },
    { id: 'hf4', name: 'Hành lang vắng', description: 'Báo động nếu bệnh nhân đột quỵ tại hành lang ít người qua lại' },
  ],
  edu_recess: [
    { id: 'er1', name: 'Khu vực cấm', description: 'Phát hiện học sinh tiếp cận sân thượng hoặc phòng kỹ thuật' },
    { id: 'er2', name: 'Tụ tập góc khuất', description: 'Cảnh báo nhóm học sinh tụ tập ở sau nhà vệ sinh hoặc góc sân bóng' },
    { id: 'er3', name: 'Ra cổng giờ giải lao', description: 'Phát hiện học sinh tự ý lẻn ra cổng trường mua đồ ăn vặt' },
    { id: 'er4', name: 'Chơi đùa gần hồ nước', description: 'Cảnh báo nếu trường có hồ/ao và học sinh chạy nhảy quá sát bờ' },
  ],
  ap_queue: [
    { id: 'aq1', name: 'Quầy thủ tục', description: 'Cảnh báo khi hàng chờ check-in quá dài hoặc đợi quá lâu' },
    { id: 'aq2', name: 'Khu soi chiếu an ninh', description: 'Đo lường thời gian hành khách phải đứng đợi qua cổng từ' },
    { id: 'aq3', name: 'Quầy hải quan', description: 'Phân tích ùn tắc tại khu vực nhập cảnh để mở thêm quầy' },
    { id: 'aq4', name: 'Cửa ra tàu bay (Gate)', description: 'Kiểm soát đám đông lúc hành khách xếp hàng lên máy bay' },
  ],
  traffic: [
    { id: 't1', name: 'Đọc biển số xe ra vào', description: 'Nhận diện và ghi lại biển số xe vào cổng công ty' },
    { id: 't2', name: 'Xe đi ngược chiều', description: 'Cảnh báo xe đi vào làn sai chiều trong bãi xe nội bộ' },
    { id: 't3', name: 'Đỗ xe trái phép', description: 'Cảnh báo xe đỗ quá 30 phút tại khu vực cấm đỗ' },
    { id: 't4', name: 'Đếm lưu lượng theo giờ', description: 'Đếm xe qua từng khung giờ để phân tích giờ cao điểm' },
    { id: 't5', name: 'Xe tải vượt tải trọng', description: 'Giám sát xe tải ra vào khu vực giới hạn tải trọng' },
    { id: 't6', name: 'Chạy quá tốc độ', description: 'Phát hiện phương tiện di chuyển quá tốc độ trong nội khu' },
  ],
  behavior: [
    { id: 'b2', name: 'Phát hiện đánh nhau', description: 'Phát hiện hành vi ẩu đả, xô xát giữa nhiều người' },
    { id: 'b3', name: 'Phát hiện hút thuốc sai quy định', description: 'Phát hiện người hút thuốc trong khu vực cấm' },
    { id: 'b4', name: 'Dùng điện thoại khi lái xe nâng', description: 'Cảnh báo tài xế xe nâng dùng điện thoại khi vận hành' },
    { id: 'b5', name: 'Ngủ gật tại vị trí làm việc', description: 'Phát hiện nhân viên mất tập trung hoặc ngủ gật' },
    { id: 'b6', name: 'Leo trèo khu vực nguy hiểm', description: 'Cảnh báo khi có người leo lên kệ hàng hoặc kết cấu không an toàn' },
  ],
  retail_analytics: [
    { id: 'r1', name: 'Heatmap lưu lượng', description: 'Phân tích vị trí khách đi lại nhiều nhất trong cửa hàng' },
    { id: 'r2', name: 'Nhân khẩu học khách', description: 'Thống kê tỷ lệ nam/nữ và độ tuổi khách theo khung giờ' },
    { id: 'r3', name: 'Kệ hàng bị trống', description: 'Cảnh báo khi kệ hàng trống để nhân viên bổ sung kịp thời' },
    { id: 'r4', name: 'Thời gian dừng tại kệ', description: 'Đo thời gian trung bình khách dừng lại tại từng kệ hàng' },
    { id: 'r5', name: 'Hành vi lấy rồi trả hàng', description: 'Theo dõi khách cầm lên rồi đặt lại sản phẩm để tối ưu kệ' },
    { id: 'r6', name: 'Phòng thử đồ chờ lâu', description: 'Cảnh báo khi phòng thử đồ có hàng chờ dài bất thường' },
  ],
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
  label_inspection: 'Kiểm tra tem nhãn / Hạn dùng', assembly_inspection: 'Lỗi lắp ráp',
  ppe: 'An toàn lao động', fire: 'Phòng cháy chữa cháy',
  traffic: 'Giao thông thông minh', behavior: 'Phân tích hành vi',
  retail_analytics: 'Phân tích Bán lẻ',
};

// ─── Use-Case Domain Definitions ─────────────────────────────────────────────

type UCParamType = 'text' | 'textarea' | 'number' | 'select' | 'select_text' | 'toggle' | 'multicheck' | 'multicheck_dynamic' | 'time_range' | 'date_range' | 'slider_pct' | 'image' | 'zone_hint' | 'line_hint' | 'bbox_per_field' | 'bbox_per_part' | 'card2' | 'card3';

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
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'confirmSeconds', label: 'Phải ở trong vùng liên tục bao lâu mới báo động', type: 'number', unit: 'giây', placeholder: '3' },
        { key: 'reason', label: 'Lý do cấm / bối cảnh khu vực', type: 'select', optional: true, options: ['Nguy hiểm / an toàn lao động', 'Có tài sản / thiết bị giá trị cao', 'Khu vực bí mật / kiểm soát', 'Máy móc đang vận hành', 'Khác'] },
        { key: 'allowedPersonnel', label: 'Ai ĐƯỢC PHÉP vào (ngoại lệ — mô tả ngoại hình)', type: 'text', optional: true, placeholder: 'VD: nhân viên bảo trì đồng phục xanh + đeo thẻ đỏ; bảo vệ đồng phục đen' },
        { key: 'excludeZone', label: 'Vùng ngoại lệ (AI bỏ qua)', type: 'zone_hint', optional: true },
        { key: 'normalActivity', label: 'Hoạt động bình thường gần khu vực (giúp AI tránh báo nhầm)', type: 'text', optional: true, placeholder: 'VD: xe tải qua lại hành lang phải; công nhân tập trung trước cửa vào ca' },
      ]},
      { id: 'sec_loitering', name: 'Lảng vảng quá lâu', taskMapType: 'security', desc: 'Phát hiện đối tượng đứng lâu bất thường tại một khu vực.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng cần phát hiện', type: 'select', options: ['Người', 'Xe', 'Bất kỳ'] },
        { key: 'maxStayMinutes', label: 'Thời gian tối đa ở lại', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'allowedPersonnel', label: 'Người được phép ở lại lâu hơn', type: 'text', optional: true },
      ]},
      { id: 'sec_afterhours', name: 'Xâm nhập ngoài giờ', taskMapType: 'security', desc: 'Giám sát và cảnh báo hoạt động trong khung giờ vắng người.', params: [
        { key: 'workHours', label: 'Giờ làm việc bình thường', type: 'time_range' },
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'confirmSeconds', label: 'Xác nhận sau', type: 'number', unit: 'giây', placeholder: '3' },
        { key: 'guardSchedule', label: 'Lịch bảo vệ tuần tra', type: 'text', optional: true, placeholder: 'VD: 22:30 và 02:30' },
        { key: 'cleaningStaff', label: 'Nhân viên vệ sinh (giờ + ngoại hình)', type: 'text', optional: true, placeholder: 'VD: 23:00–01:00, đồng phục xám' },
        { key: 'overtime', label: 'Ai được ở lại tăng ca', type: 'text', optional: true },
      ]},
      { id: 'sec_assetloss', name: 'Vật thể rời vị trí', taskMapType: 'security', needsImage: true, multipleImages: true, imageLabel: 'Ảnh tài sản cần bảo vệ (giúp AI nhận dạng chính xác hơn)', desc: 'Báo động khi đồ vật quan trọng bị di dời khỏi vị trí.', params: [
        { key: 'assetDesc', label: 'Mô tả tài sản cần bảo vệ', type: 'text', placeholder: 'VD: laptop bạc Dell XPS, máy chiếu đen Epson' },
        { key: 'assetZone', label: 'Vùng đặt tài sản', type: 'zone_hint' },
        { key: 'missingSeconds', label: 'Tài sản mất bao lâu mới báo', type: 'number', unit: 'giây', placeholder: '30' },
        { key: 'allowedPersonnel', label: 'Ai được phép di chuyển tài sản', type: 'text', optional: true },
        { key: 'tempMoveMinutes', label: 'Cho phép di chuyển tạm trong', type: 'number', unit: 'phút', optional: true, placeholder: '5' },
      ]},

      { id: 'sec_crowd', name: 'Tụ tập đông người', taskMapType: 'security', desc: 'Nhận diện tình trạng tụ tập đông người bất thường.', params: [
        { key: 'zone', label: 'Vùng cần kiểm soát', type: 'zone_hint' },
        { key: 'minPeople', label: 'Số người tối thiểu để báo', type: 'number', placeholder: '5' },
        { key: 'minSeconds', label: 'Thời gian tụ tập tối thiểu', type: 'number', unit: 'giây', placeholder: '30' },
        { key: 'allowedZone', label: 'Khu vực được phép tụ tập', type: 'zone_hint', optional: true },
        { key: 'breakHours', label: 'Giờ nghỉ ca / giờ ăn (bình thường)', type: 'time_range', optional: true },
      ]},
      { id: 'sec_vehicle_reid', name: 'Tìm kiếm phương tiện (Re-ID)', taskMapType: 'security', needsImage: true, imageLabel: 'Ảnh xe mẫu cần tìm — upload rồi khoanh vùng thân xe nếu ảnh có nhiều nền', desc: 'Tìm kiếm và nhận diện lại phương tiện giống với ảnh mẫu.', params: [
        { key: 'similarityThreshold', label: 'Ngưỡng tương đồng tối thiểu', type: 'slider_pct' },
        { key: 'vehicleTypes', label: 'Loại xe ưu tiên', type: 'multicheck', optional: true, options: ['Ô tô', 'Xe máy', 'Xe tải', 'Xe buýt'] },
        { key: 'colors', label: 'Màu sắc xe', type: 'multicheck', optional: true, options: ['Trắng', 'Đen', 'Bạc / Xám', 'Đỏ', 'Xanh lam', 'Xanh lá', 'Vàng', 'Nâu'] },
        { key: 'maxResults', label: 'Số kết quả tối đa trả về', type: 'number', optional: true, placeholder: '20' },
        { key: 'noPlate', label: 'Chỉ tìm xe không rõ / bị che biển số', type: 'toggle', optional: true },
      ]},
      { id: 'sec_camera_tamper', name: 'Phát hiện camera bị che, bị xoay lệch, mất nét, hình ảnh quá tối hoặc mất tín hiệu.', taskMapType: 'security', desc: 'Phát hiện trường hợp camera bị vật thể che trước ống kính, bị dán băng, bị che bởi tay/người/vật, hoặc vùng nhìn bị che quá nhiều khiến hệ thống không thể giám sát bình thường.', params: [
        { key: 'occlusionThreshold', label: 'Tỷ lệ khung hình bị che tối thiểu để báo', type: 'slider_pct' },
        { key: 'duration', label: 'Thời gian bị che liên tục mới cảnh báo', type: 'number', unit: 'giây' },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'recipient', label: 'Người nhận cảnh báo', type: 'text', placeholder: 'Email/SĐT' },
      ]},
      { id: 'sec_door_abnormal', name: 'Cửa mở bất thường', taskMapType: 'security', desc: 'Phát hiện cửa kho, cửa phòng server, cửa thoát hiểm hoặc cửa khu vực hạn chế bị mở quá lâu hoặc mở ngoài khung giờ cho phép.', params: [
        { key: 'zone', label: 'Vị trí cửa cần giám sát', type: 'zone_hint' },
        { key: 'normalState', label: 'Trạng thái cửa bình thường', type: 'select', options: ['Đóng', 'Mở'] },
        { key: 'maxOpenSeconds', label: 'Thời gian mở tối đa cho phép', type: 'number', unit: 'giây' },
        { key: 'allowedHours', label: 'Khung giờ được phép mở cửa', type: 'time_range' },
        { key: 'allowedPersonnel', label: 'Người/khu vực được phép ra vào', type: 'text' },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'sec_wrong_way', name: 'Đi sai hướng', taskMapType: 'security', desc: 'Phát hiện người hoặc xe di chuyển ngược chiều so với hướng được phép tại hành lang, cổng, lối ra/vào hoặc khu vực kiểm soát một chiều.', params: [
        { key: 'line', label: 'Vạch kiểm soát', type: 'line_hint' },
        { key: 'direction', label: 'Hướng hợp lệ', type: 'select', options: ['Từ ngoài vào trong', 'Từ trong ra ngoài'] },
        { key: 'target', label: 'Đối tượng áp dụng', type: 'select', options: ['Người', 'Xe', 'Cả hai'] },
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận', type: 'number', unit: 'giây' },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'sec_abandoned_object', name: 'Vật thể bỏ quên', taskMapType: 'security', desc: 'Phát hiện túi, hộp, vali, thùng hàng hoặc vật thể lạ bị để lại trong khu vực giám sát quá lâu.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'objectTypes', label: 'Loại vật thể cần theo dõi', type: 'multicheck', options: ['Túi', 'Hộp', 'Vali', 'Thùng hàng', 'Khác'] },
        { key: 'maxIdleMinutes', label: 'Thời gian vật thể đứng yên tối thiểu', type: 'number', unit: 'phút' },
        { key: 'allowedZone', label: 'Khu vực được phép đặt đồ', type: 'zone_hint', optional: true },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
    ]
  },
  {
    key: 'traffic', name: 'Giao thông/Bãi xe', color: 'amber',
    useCases: [
      { id: 'tra_alpr', name: 'Nhận diện biển số', taskMapType: 'traffic', desc: 'Tự động đọc biển số xe và đối chiếu danh sách trắng/đen.', params: [
        { key: 'vehicleTypes', label: 'Loại xe cần nhận diện', type: 'multicheck', options: ['Ô tô', 'Xe máy', 'Xe tải', 'Xe buýt'] },
{ key: 'action', label: 'Hành động khi phát hiện', type: 'select', options: ['Chỉ ghi log', 'Cảnh báo', 'Gọi webhook mở barrier'] },
        { key: 'whitelist', label: 'Danh sách xe được phép vào', type: 'textarea', optional: true, placeholder: 'Mỗi dòng một biển số' },
        { key: 'blacklist', label: 'Danh sách xe bị cấm', type: 'textarea', optional: true, placeholder: 'Mỗi dòng một biển số' },
        { key: 'unknownAction', label: 'Xe không có trong danh sách', type: 'select', options: ['Cho qua + ghi log', 'Cảnh báo', 'Chặn'] },
        { key: 'historyDays', label: 'Lưu lịch sử bao nhiêu ngày', type: 'number', placeholder: '30' },
      ]},
      { id: 'tra_count', name: 'Đếm phương tiện qua vạch', taskMapType: 'counting', desc: 'Đo lường số lượng phương tiện đi qua một vạch/vùng cụ thể.', params: [
        { key: 'vehicleTypes', label: 'Loại xe cần đếm', type: 'multicheck', options: ['Xe máy', 'Ô tô', 'Xe tải', 'Xe đạp', 'Tất cả'] },
        { key: 'direction', label: 'Hướng đếm', type: 'card3', options: ['Chỉ vào', 'Chỉ ra', 'Cả 2 chiều'] },
        { key: 'line', label: 'Vị trí vạch đếm', type: 'line_hint' },
        { key: 'alertThreshold', label: 'Cảnh báo khi số xe vượt ngưỡng', type: 'number', unit: 'xe/giờ', optional: true },
        { key: 'ignoreParked', label: 'Bỏ qua xe đang đỗ (chỉ đếm xe di chuyển)', type: 'toggle', optional: true },
        { key: 'reportPeriod', label: 'Báo cáo tổng kết theo', type: 'select', options: ['Theo giờ', 'Theo ca', 'Theo ngày'] },
      ]},
      { id: 'tra_parking', name: 'Dừng đỗ sai quy định', taskMapType: 'traffic', desc: 'Phát hiện các phương tiện dừng đỗ tại khu vực cấm.', params: [
        { key: 'zone', label: 'Vùng cấm dừng đỗ', type: 'zone_hint' },
        { key: 'maxMinutes', label: 'Thời gian tối đa được dừng', type: 'number', unit: 'phút', placeholder: '5' },
        { key: 'hazardGrace', label: 'Xe bật đèn cảnh báo (hazard) được gia hạn thêm', type: 'toggle', optional: true },
        { key: 'exemptVehicles', label: 'Xe nào được miễn', type: 'multicheck', optional: true, options: ['Xe cứu thương', 'Xe cứu hỏa', 'Xe bảo trì'] },
        { key: 'loadingZone', label: 'Khu vực bốc dỡ hàng (cho phép đỗ)', type: 'zone_hint', optional: true },
      ]},
      { id: 'tra_speed', name: 'Cảnh báo vi phạm tốc độ', taskMapType: 'traffic', desc: 'Ước lượng tốc độ và cảnh báo xe chạy quá giới hạn.', params: [
        { key: 'refDistance', label: 'Khoảng cách tham chiếu', type: 'number', unit: 'mét', placeholder: '10' },
        { key: 'vehicleTypes', label: 'Loại phương tiện', type: 'multicheck', options: ['Xe máy', 'Ô tô', 'Xe tải', 'Tất cả'] },
        { key: 'maxSpeed', label: 'Ngưỡng tốc độ tối đa', type: 'number', unit: 'km/h', placeholder: '40' },
        { key: 'minSpeed', label: 'Ngưỡng tốc độ tối thiểu', type: 'number', unit: 'km/h', optional: true, placeholder: '5' },
        { key: 'direction', label: 'Hướng di chuyển giám sát', type: 'card3', options: ['Trái → Phải', 'Phải → Trái', 'Cả hai'] },
      ]},
      { id: 'tra_congestion', name: 'Ùn tắc tại cổng', taskMapType: 'traffic', desc: 'Phát hiện số lượng xe chờ tại cổng, barrier, lối vào bãi xe hoặc cổng nhà máy vượt ngưỡng cho phép.', params: [
        { key: 'waitingZone', label: 'Vùng chờ tại cổng (vẽ phân biệt với ROI)', type: 'zone_hint' },
        { key: 'maxVehicles', label: 'Số xe tối đa cho phép', type: 'number' },
        { key: 'minMinutes', label: 'Thời gian ùn tắc tối thiểu', type: 'number', unit: 'phút' },
        { key: 'vehicleTypes', label: 'Loại xe áp dụng', type: 'multicheck', options: ['Ô tô', 'Xe máy', 'Xe tải', 'Xe buýt'] },
        { key: 'peakHours', label: 'Khung giờ cao điểm', type: 'time_range', optional: true },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'tra_smartpark', name: 'Bãi đỗ xe thông minh', taskMapType: 'counting', desc: 'Theo dõi trạng thái từng ô đỗ xe để xác định số chỗ trống, số chỗ đã sử dụng và cảnh báo khi bãi gần đầy hoặc đầy.', params: [
        { key: 'zones', label: 'Danh sách ô đỗ xe', type: 'zone_hint' },
        { key: 'vehicleTypes', label: 'Loại xe áp dụng', type: 'select', options: ['Ô tô', 'Xe máy'] },
        { key: 'almostFullThreshold', label: 'Ngưỡng bãi gần đầy', type: 'number', placeholder: 'Số chỗ hoặc %' },
        { key: 'fullThreshold', label: 'Ngưỡng bãi đầy', type: 'number', placeholder: 'Số chỗ hoặc %' },
        { key: 'updateInterval', label: 'Chu kỳ cập nhật', type: 'number', unit: 'giây/phút' },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
    ]
  },
  {
    key: 'production', name: 'Sản xuất', color: 'violet',
    useCases: [
      { id: 'prd_label', name: 'Kiểm tra tem nhãn / hạn dùng', taskMapType: 'label_inspection', needsImage: true, imageLabel: 'Ảnh mẫu sản phẩm (vị trí nhãn rõ)', desc: 'Kiểm tra lỗi in ấn, thiếu tem nhãn, bao bì rách nát.', params: [
        { key: 'fields', label: 'Trường thông tin cần đọc', type: 'multicheck', options: ['Ngày sản xuất (NSX)', 'Hạn sử dụng (HSD)', 'Số lô (LOT)', 'Mã vạch', 'Mã QR'] },
        { key: 'fieldZones', label: 'Vùng mỗi trường trên sản phẩm (vẽ trên ảnh mẫu)', type: 'bbox_per_field' },
        { key: 'mfgFormat', label: 'Định dạng Ngày sản xuất', type: 'select_text', options: ['DD/MM/YYYY', 'MM/YYYY', 'YYYY-MM-DD', 'YYYYMMDD', 'DD-MM-YYYY'] },
        { key: 'expFormat', label: 'Định dạng Hạn sử dụng', type: 'select_text', options: ['DD/MM/YYYY', 'MM/YYYY', 'YYYY-MM-DD', 'YYYYMMDD', 'DD-MM-YYYY'] },
        { key: 'lotFormat', label: 'Định dạng Số lô (regex)', type: 'text', optional: true, placeholder: 'VD: [A-Z]{2}\\d{6} hoặc LOT\\d{4}-\\d{2}' },
        { key: 'minShelfLife', label: 'HSD phải cách NSX tối thiểu', type: 'number', unit: 'ngày', optional: true, placeholder: '180' },
        { key: 'minRemainingDays', label: 'HSD phải còn hạn tối thiểu', type: 'number', unit: 'ngày', optional: true, placeholder: '30' },
        { key: 'language', label: 'Ngôn ngữ trên nhãn', type: 'select', options: ['Tiếng Việt', 'Tiếng Anh', 'Song ngữ (Việt + Anh)', 'Khác'] },
      ]},
      { id: 'prd_assembly', name: 'Lỗi lắp ráp', taskMapType: 'assembly_inspection', needsImage: true, multipleImages: true, imageLabel: 'Ảnh mẫu sản phẩm lắp đúng', desc: 'Phát hiện linh kiện bị thiếu, sai vị trí, lắp ráp ngược.', params: [
        { key: 'parts', label: 'Liệt kê các bộ phận cần có', type: 'textarea', placeholder: 'Mỗi bộ phận một dòng hoặc cách nhau bởi dấu phẩy\nVD: nắp, gioăng cao su, tem bảo hành, 4 ốc vít' },
        { key: 'partZones', label: 'Vùng từng bộ phận trên ảnh sản phẩm (vẽ trên ảnh mẫu)', type: 'bbox_per_part' },
        { key: 'multiVersion', label: 'Sản phẩm có nhiều phiên bản', type: 'toggle' },

      ]},
      { id: 'prd_counting', name: 'Giám sát dây chuyền sản xuất', taskMapType: 'counting', needsImage: true, multipleImages: true, imageLabel: 'Ảnh sản phẩm cần đếm (để trống = đếm tất cả)', desc: 'Theo dõi hoạt động dây chuyền, bao gồm đếm sản phẩm, giám sát năng suất, phát hiện dây chuyền dừng hoặc sản phẩm bị kẹt.', params: [
        { key: 'zone', label: 'Vùng dây chuyền cần giám sát', type: 'zone_hint' },
        { key: 'line', label: 'Vạch đếm sản phẩm', type: 'line_hint', optional: true },
        { key: 'targetPerShift', label: 'Mục tiêu sản lượng ca', type: 'number', placeholder: '2000' },
        { key: 'alertBelowPct', label: 'Cảnh báo khi năng suất dưới', type: 'number', unit: '%' },
        { key: 'stopAlertSeconds', label: 'Dây chuyền dừng bao lâu thì báo', type: 'number', unit: 'giây/phút' },
        { key: 'jamAlertSeconds', label: 'Sản phẩm đứng yên bao lâu thì báo', type: 'number', unit: 'giây' },
        { key: 'countRejects', label: 'Đếm riêng sản phẩm bị từ chối', type: 'toggle', optional: true },
        { key: 'activeHours', label: 'Giờ sản xuất', type: 'time_range' },
        { key: 'maintenanceHours', label: 'Giờ nghỉ/bảo trì', type: 'time_range', optional: true },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'prd_productivity', name: 'Giám sát năng suất', taskMapType: 'behavior', desc: 'Phân tích và đo lường thời gian chu kỳ (cycle time).', params: [
        { key: 'zone', label: 'Khu vực giám sát', type: 'zone_hint' },
        { key: 'targetPerShift', label: 'Mục tiêu sản lượng ca', type: 'number', placeholder: '500' },
        { key: 'alertBelowPct', label: 'Cảnh báo khi năng suất dưới', type: 'number', unit: '%', placeholder: '80' },
        { key: 'workerCount', label: 'Số nhân công trong khu vực', type: 'number', optional: true },
        { key: 'workHours', label: 'Giờ làm việc', type: 'time_range' },
      ]},
    ]
  },
  {
    key: 'safety', name: 'An toàn lao động', color: 'orange',
    useCases: [
      { id: 'hse_ppe', name: 'Thiếu trang thiết bị bảo hộ', taskMapType: 'ppe', desc: 'Kiểm tra nhân viên có mặc đủ áo phản quang, mũ, kính bảo hộ.', params: [
        { key: 'zone', label: 'Khu vực yêu cầu PPE', type: 'zone_hint' },
        { key: 'requiredPPE', label: 'PPE bắt buộc tại khu vực này', type: 'multicheck', options: ['Mũ bảo hộ', 'Áo phản quang', 'Găng tay', 'Khẩu trang', 'Kính bảo hộ'] },
        { key: 'triggerMode', label: 'Điều kiện kích hoạt', type: 'card2', options: ['Thiếu BẤT KỲ 1 PPE', 'Thiếu TẤT CẢ PPE'] },
        { key: 'ppeColors', label: 'Màu PPE ở cơ sở này', type: 'text', optional: true, placeholder: 'VD: Mũ vàng, áo cam' },
        { key: 'exempt', label: 'Ai được miễn PPE', type: 'text', optional: true },
        { key: 'staffAppearance', label: 'Nhân viên nhận dạng thế nào', type: 'text', optional: true, placeholder: 'VD: đồng phục xanh công ty' },
        { key: 'graceSeconds', label: 'Cho phép tháo PPE tạm trong', type: 'number', unit: 'giây', optional: true, placeholder: '30' },
      ]},
      { id: 'hse_machine', name: 'Người vào khu vực nguy hiểm', taskMapType: 'security', desc: 'Báo động khi người tiến quá gần máy móc đang hoạt động.', params: [
        { key: 'zone', label: 'Vùng nguy hiểm', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Điều kiện vào vùng', type: 'card2', options: ['Chạm viền (phản ứng ngay)', 'Tâm đối tượng trong vùng'] },
        { key: 'onlyWhenRunning', label: 'Chỉ báo khi máy đang chạy', type: 'toggle', optional: true },
        { key: 'allowedPersonnel', label: 'Ai được vào vùng này', type: 'text', optional: true, placeholder: 'VD: kỹ thuật viên mặc áo cam' },
        { key: 'maintenanceSchedule', label: 'Lịch bảo trì (được vào)', type: 'time_range', optional: true },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thông báo', 'Dừng máy tự động qua webhook', 'Cả hai'] },
      ]},
      { id: 'hse_fight', name: 'Phát hiện hành vi bất thường', taskMapType: 'behavior', desc: 'Phát hiện tình huống nhiều người có hành vi xô xát, ẩu đả hoặc va chạm bất thường trong khu vực giám sát.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'minPeople', label: 'Số người tối thiểu để cảnh báo', type: 'number' },
        { key: 'confirmSeconds', label: 'Thời gian xảy ra tối thiểu', type: 'number', unit: 'giây' },
        { key: 'excludeZone', label: 'Khu vực bỏ qua', type: 'zone_hint', optional: true },
        { key: 'sensitivity', label: 'Độ nhạy phát hiện', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'hse_phone', name: 'Dùng điện thoại vùng cấm', taskMapType: 'behavior', desc: 'Phát hiện người sử dụng điện thoại trong khu vực cấm như dây chuyền sản xuất, khu vực vận hành máy hoặc khu vực bảo mật.', params: [
        { key: 'zone', label: 'Vùng cấm sử dụng điện thoại', type: 'zone_hint' },
        { key: 'confirmSeconds', label: 'Thời gian hành vi tối thiểu', type: 'number', unit: 'giây' },
        { key: 'activeHours', label: 'Khung giờ áp dụng', type: 'time_range' },
        { key: 'exempt', label: 'Người/khu vực được miễn', type: 'text' },
        { key: 'sensitivity', label: 'Độ nhạy phát hiện', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'severity', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'hse_proximity', name: 'Kiểm soát an toàn người - máy', taskMapType: 'security', desc: 'Cảnh báo khi khoảng cách giữa người và phương tiện quá gần.', params: [
        { key: 'zone', label: 'Vùng nguy hiểm quanh máy', type: 'zone_hint' },
        { key: 'minDistance', label: 'Khoảng cách an toàn tối thiểu', type: 'number', unit: 'mét', placeholder: '1.5' },
        { key: 'alertAction', label: 'Hành động khi vi phạm', type: 'select', options: ['Cảnh báo trên màn hình', 'Gửi webhook + cảnh báo', 'Cả hai'] },
        { key: 'machineRunning', label: 'Chỉ giám sát khi máy đang hoạt động', type: 'toggle', optional: true },
        { key: 'allowedPersonnel', label: 'Người được phép đến gần', type: 'text', optional: true },
      ]},
    ]
  },
  {
    key: 'fire', name: 'PCCC', color: 'rose',
    useCases: [
      { id: 'fir_fire', name: 'Phát hiện khói/lửa', taskMapType: 'fire', desc: 'Phát hiện sớm các dấu hiệu hỏa hoạn qua camera thường.', params: [
        { key: 'hazardTypes', label: 'Loại mối nguy cần phát hiện', type: 'multicheck', options: ['Khói', 'Lửa / ngọn lửa'] },
        { key: 'sensitivity', label: 'Mức độ nhạy', type: 'card3', options: ['Cao', 'Trung bình', 'Thấp'] },
        { key: 'dustyEnv', label: 'Môi trường có hơi / bụi thường xuyên (tránh báo nhầm)', type: 'toggle', optional: true },
        { key: 'allowedZone', label: 'Khu vực được phép có khói / lửa', type: 'zone_hint', optional: true },
        { key: 'material', label: 'Vật liệu chủ yếu trong khu vực', type: 'select', optional: true, options: ['Gỗ', 'Nhựa', 'Hóa chất', 'Dầu', 'Hỗn hợp'] },
      ]},
      { id: 'fir_smoking', name: 'Hút thuốc vùng cấm', taskMapType: 'behavior', desc: 'Phát hiện hành vi hút thuốc lá ở nơi có nguy cơ cháy nổ.', params: [
        { key: 'zone', label: 'Vùng cấm hút thuốc', type: 'zone_hint' },
        { key: 'sensitivity', label: 'Mức độ nhạy', type: 'card3', options: ['Cao', 'Trung bình', 'Thấp'] },
        { key: 'allowedZone', label: 'Khu vực cho phép hút thuốc', type: 'zone_hint', optional: true },
      ]},
      { id: 'fir_exit', name: 'Lỗi thoát hiểm bị chặn', taskMapType: 'security', desc: 'Cảnh báo khi hành lang, lối thoát hiểm bị vật cản che lấp.', params: [
        { key: 'exitZones', label: 'Vị trí các lối thoát hiểm', type: 'zone_hint' },
        { key: 'blockedPct', label: 'Coi là bị chặn khi bị che bao nhiêu %', type: 'slider_pct' },
        { key: 'confirmSeconds', label: 'Báo sau bao lâu', type: 'number', unit: 'giây', placeholder: '10' },
        { key: 'loadingHours', label: 'Giờ bốc dỡ hàng qua lối thoát (cho phép)', type: 'time_range', optional: true },
      ]},
    ]
  },
  {
    key: 'retail', name: 'Bán lẻ & khách hàng', color: 'emerald',
    useCases: [
      { id: 'ret_counting', name: 'Đếm khách ra/vào', taskMapType: 'counting', desc: 'Đo lường lượt khách hàng đi qua cửa/vào khu vực.', params: [
        { key: 'line', label: 'Vị trí cửa vào', type: 'line_hint' },
        { key: 'direction', label: 'Hướng đếm', type: 'card3', options: ['Chỉ vào', 'Chỉ ra', 'Cả 2 chiều'] },
        { key: 'maxSimultaneous', label: 'Cảnh báo khi có bao nhiêu khách đồng thời', type: 'number', optional: true },
        { key: 'staffAppearance', label: 'Nhân viên nhận dạng thế nào (không đếm)', type: 'text', optional: true, placeholder: 'VD: đồng phục áo đỏ' },
        { key: 'reportPeriod', label: 'Báo cáo tổng kết theo', type: 'select', options: ['Mỗi giờ', 'Mỗi ca', 'Cuối ngày'] },
        { key: 'peakHours', label: 'Giờ cao điểm bình thường', type: 'time_range', optional: true },
      ]},
      { id: 'ret_heatmap', name: 'Heatmap khu vực', taskMapType: 'retail_analytics', desc: 'Phân tích khu vực thu hút nhiều sự chú ý của khách hàng nhất.', params: [
        { key: 'zone', label: 'Khu vực giám sát', type: 'zone_hint' },
        { key: 'objectType', label: 'Loại đối tượng', type: 'select', options: ['Người', 'Xe', 'Tất cả'] },
        { key: 'aggregatePeriod', label: 'Khoảng thời gian tổng hợp', type: 'select', options: ['1 giờ', '1 ca', '1 ngày', '1 tuần'] },
        { key: 'gridSize', label: 'Kích thước ô lưới', type: 'number', unit: 'mét', placeholder: '1' },
      ]},
      { id: 'ret_shelf', name: 'Kệ hàng trống', taskMapType: 'retail_analytics', needsImage: true, multipleImages: true, imageLabel: 'Ảnh kệ hàng khi đầy hàng', desc: 'Cảnh báo nhân viên khi hàng hóa trên kệ sắp hết.', params: [
        { key: 'emptyThreshold', label: 'Coi là trống khi diện tích kệ trống vượt', type: 'slider_pct' },
        { key: 'notifyTo', label: 'Ai cần nhận thông báo', type: 'text', placeholder: 'VD: nhân viên kho, trưởng khu vực' },
        { key: 'restockMinutes', label: 'Cần bổ sung hàng trong bao lâu', type: 'number', unit: 'phút', placeholder: '15' },
        { key: 'inventoryTime', label: 'Giờ kiểm kê đầu ngày (không báo)', type: 'time_range', optional: true },
        { key: 'allowRearrange', label: 'Hàng được sắp xếp lại thường xuyên (tránh báo nhầm)', type: 'toggle', optional: true },
      ]},

      { id: 'ret_queue', name: 'Giám sát hàng chờ', taskMapType: 'counting', desc: 'Đo lường độ dài hàng chờ và thời gian chờ của khách.', params: [
        { key: 'zone', label: 'Khu vực xếp hàng / quầy phục vụ', type: 'zone_hint' },
        { key: 'alertPeople', label: 'Cảnh báo khi số người xếp hàng vượt', type: 'number', placeholder: '8' },
        { key: 'minQueueSeconds', label: 'Phải xếp hàng bao lâu mới tính', type: 'number', unit: 'giây', placeholder: '60' },
        { key: 'maxWaitSeconds', label: 'Thời gian chờ tối đa mỗi khách', type: 'number', unit: 'giây', placeholder: '120' },
        { key: 'counterCount', label: 'Số quầy phục vụ', type: 'number', placeholder: '3' },
        { key: 'serviceTime', label: 'Thời gian phục vụ trung bình mỗi khách', type: 'number', unit: 'giây', placeholder: '60' },
        { key: 'alertOnOvertime', label: 'Cảnh báo khi khách chờ vượt thời gian tối đa', type: 'toggle', optional: true },
        { key: 'peakHours', label: 'Giờ cao điểm thường có hàng dài', type: 'time_range', optional: true },
      ]},
      { id: 'ret_crowdanalysis', name: 'Mật độ khách hàng', taskMapType: 'retail_analytics', desc: 'Đánh giá tỷ lệ lấp đầy để tối ưu nhân sự phục vụ.', params: [
        { key: 'zone', label: 'Khu vực giám sát', type: 'zone_hint' },
        { key: 'busyThreshold', label: 'Ngưỡng đông', type: 'number', unit: 'người', placeholder: '20' },
        { key: 'quietThreshold', label: 'Ngưỡng vắng', type: 'number', unit: 'người', placeholder: '5' },
        { key: 'aggregatePeriod', label: 'Khoảng thời gian tổng hợp', type: 'select', options: ['30 phút', '1 giờ', '1 ca'] },
        { key: 'autoThreshold', label: 'Tự động điều chỉnh ngưỡng', type: 'toggle', optional: true },
      ]},
      { id: 'ret_staff_absence', name: 'Nhân viên rời quầy quá lâu', taskMapType: 'behavior', desc: 'Giám sát quầy thu ngân, quầy tư vấn hoặc quầy lễ tân. Nếu trong khung giờ làm việc không có nhân viên tại quầy quá thời gian cho phép thì cảnh báo.', params: [
        { key: 'zone', label: 'Vùng quầy cần giám sát', type: 'zone_hint' },
        { key: 'target', label: 'Đối tượng cần có mặt', type: 'select', options: ['Nhân viên'] },
        { key: 'maxAbsenceMinutes', label: 'Thời gian vắng mặt tối đa cho phép', type: 'number', unit: 'phút' },
        { key: 'workHours', label: 'Giờ làm việc của quầy', type: 'time_range' },
        { key: 'breakHours', label: 'Giờ nghỉ/đổi ca', type: 'time_range', optional: true },
        { key: 'staffAppearance', label: 'Cách phân biệt nhân viên với khách', type: 'text', optional: true, placeholder: 'VD: màu đồng phục' },
        { key: 'notifyTo', label: 'Người nhận cảnh báo', type: 'text', placeholder: 'VD: Quản lý cửa hàng' },
      ]},
    ]
  },
  {
    key: 'warehouse', name: 'Kho bãi & logistics', color: 'cyan',
    useCases: [
      { id: 'wh_forklift', name: 'Người vào đường xe nâng', taskMapType: 'security', desc: 'Cảnh báo va chạm giữa xe nâng và nhân viên.', params: [
        { key: 'zone', label: 'Tuyến đường xe nâng', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Phản ứng ngay khi', type: 'card2', options: ['Chân chạm viền vùng (intersect)', 'Đứng hẳn trong vùng (inside)'] },
        { key: 'alertLevel', label: 'Mức cảnh báo', type: 'select', options: ['Chỉ thông báo', 'Kích hoạt còi tự động', 'Gửi lệnh dừng xe nâng'] },
        { key: 'allowedPersonnel', label: 'Ai được vào đường xe nâng', type: 'text', optional: true, placeholder: 'VD: lái xe nâng có thẻ vàng' },
        { key: 'forkActiveHours', label: 'Xe nâng chỉ hoạt động vào giờ', type: 'time_range', optional: true },
      ]},
      { id: 'wh_wrongzone', name: 'Xe vào sai khu vực', taskMapType: 'security', desc: 'Phát hiện phương tiện đi nhầm luồng hoặc vào khu vực sai.', params: [
        { key: 'zone', label: 'Khu vực cấm xe', type: 'zone_hint' },
        { key: 'bannedTypes', label: 'Loại xe bị cấm', type: 'multicheck', options: ['Xe tải', 'Xe máy', 'Xe khách', 'Xe con'] },
        { key: 'allowedList', label: 'Danh sách xe được phép', type: 'textarea', optional: true, placeholder: 'Mỗi dòng một biển số' },
      ]},
      { id: 'wh_inventory', name: 'Giám sát mức tồn kho kệ', taskMapType: 'retail_analytics', desc: 'Theo dõi và đánh giá dung lượng lưu trữ trên các kệ hàng.', params: [
        { key: 'shelfZones', label: 'Vị trí các kệ cần giám sát', type: 'zone_hint' },
        { key: 'minStock', label: 'Số lượng tồn tối thiểu', type: 'number', placeholder: '10' },
        { key: 'emptyThreshold', label: 'Coi là hết hàng khi', type: 'slider_pct' },
      ]},
      { id: 'wh_counting', name: 'Đếm hàng xuất/nhập kho', taskMapType: 'counting', needsImage: true, multipleImages: true, imageLabel: 'Ảnh kiện hàng cần đếm (tuỳ chọn — để trống = đếm tất cả)', desc: 'Đếm số lượng hàng hóa được xếp lên hoặc hạ xuống xe tải.', params: [
        { key: 'line', label: 'Vị trí cổng xuất / nhập', type: 'line_hint' },
        { key: 'plannedQty', label: 'Số lượng theo kế hoạch hôm nay', type: 'number', placeholder: '500' },
        { key: 'deviationPct', label: 'Sai lệch bao nhiêu % thì báo', type: 'number', unit: '%', placeholder: '5' },
        { key: 'truckCount', label: 'Hàng đến từ bao nhiêu chuyến xe', type: 'number', optional: true, placeholder: '3' },
      ]},
      { id: 'wh_truck', name: 'Kiểm soát xe ra/vào bằng biển số', taskMapType: 'traffic', desc: 'Nhận diện và quản lý xe tải đến giao/nhận hàng.', params: [
        { key: 'useALPR', label: 'Đọc biển số xe tải tự động', type: 'toggle' },
        { key: 'expectedTrucks', label: 'Xe tải dự kiến hôm nay', type: 'textarea', optional: true, placeholder: 'Mỗi dòng một biển số' },
        { key: 'unknownAction', label: 'Hành động khi xe không trong danh sách', type: 'select', options: ['Chỉ cảnh báo', 'Không mở barrier', 'Ghi log + cảnh báo'] },
      ]},
      { id: 'wh_wrongitem', name: 'Hàng đặt sai khu vực', taskMapType: 'security', desc: 'Phát hiện hàng hóa, pallet hoặc thùng hàng được đặt vào khu vực không đúng quy định, ví dụ hàng thành phẩm đặt ở khu nguyên liệu, hàng chờ xuất đặt sai lane, hàng nguy hiểm đặt sai vùng.', params: [
        { key: 'zones', label: 'Danh sách khu vực kho', type: 'zone_hint' },
        { key: 'itemType', label: 'Loại hàng/ký hiệu hàng theo khu vực', type: 'text', placeholder: 'Loại hàng/ký hiệu' },
        { key: 'zoneMapping', label: 'Khu vực hợp lệ của từng loại hàng', type: 'textarea', placeholder: 'Mỗi dòng 1 mapping (VD: Hóa chất -> Khu A)' },
        { key: 'tempMinutes', label: 'Thời gian cho phép đặt tạm', type: 'number', unit: 'phút' },
        { key: 'transitZone', label: 'Khu vực trung chuyển được phép', type: 'zone_hint', optional: true },
        { key: 'recognitionMethod', label: 'Cách nhận diện hàng', type: 'text', optional: true, placeholder: 'VD: barcode, màu, hình dạng' },
      ]},
    ]
  },
  {
    key: 'building', name: 'Tòa nhà & văn phòng', color: 'indigo',
    useCases: [
      { id: 'bld_inout', name: 'Ra/vào toà nhà', taskMapType: 'counting', desc: 'Đếm và ghi nhận số lượt người ra/vào tòa nhà, sảnh chính, văn phòng, tầng làm việc hoặc khu vực kiểm soát.', params: [
        { key: 'line', label: 'Vị trí cửa ra/vào', type: 'line_hint' },
        { key: 'alertThreshold', label: 'Ngưỡng số người ra/vào bất thường', type: 'number', optional: true },
        { key: 'reportPeriod', label: 'Báo cáo tổng hợp theo', type: 'select', options: ['Giờ', 'Ngày', 'Tuần'] },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'], optional: true },
      ]},
      { id: 'bld_restricted', name: 'Khu vực hạn chế', taskMapType: 'security', desc: 'Phát hiện người đi vào khu vực hạn chế như phòng server, phòng kỹ thuật, kho tài liệu, khu vực nội bộ hoặc tầng không được phép ra vào.', params: [
        { key: 'zone', label: 'Vùng hạn chế', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'allowedHours', label: 'Khung giờ được phép ra vào', type: 'time_range' },
        { key: 'allowedPersonnel', label: 'Người/nhóm được phép vào', type: 'text', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận vi phạm', type: 'number', unit: 'giây' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'bld_door_abnormal', name: 'Cửa mở bất thường', taskMapType: 'security', desc: 'Phát hiện cửa phòng server, cửa kho, cửa kỹ thuật, cửa thoát hiểm hoặc cửa khu vực hạn chế bị mở quá lâu hoặc mở ngoài khung giờ cho phép.', params: [
        { key: 'zone', label: 'Vị trí cửa cần giám sát', type: 'zone_hint' },
        { key: 'normalState', label: 'Trạng thái cửa bình thường', type: 'select', options: ['Đóng', 'Mở'] },
        { key: 'maxOpenTime', label: 'Thời gian mở tối đa cho phép', type: 'number', unit: 'giây/phút' },
        { key: 'allowedHours', label: 'Khung giờ được phép mở cửa', type: 'time_range' },
        { key: 'allowedPersonnel', label: 'Người/khu vực được phép ra vào', type: 'text', optional: true },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'bld_elevator_queue', name: 'Hàng chờ thang máy', taskMapType: 'counting', desc: 'Phát hiện số lượng người chờ thang máy tại sảnh thang vượt ngưỡng hoặc kéo dài trong thời gian cao điểm.', params: [
        { key: 'zone', label: 'Vùng sảnh thang máy', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số người chờ tối đa', type: 'number' },
        { key: 'maxWaitMinutes', label: 'Thời gian chờ tối đa', type: 'number', unit: 'phút' },
        { key: 'peakHours', label: 'Khung giờ cao điểm', type: 'time_range', optional: true },
        { key: 'floor', label: 'Tầng/khu vực áp dụng', type: 'text' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'bld_public_density', name: 'Mật độ khu vực công cộng', taskMapType: 'retail_analytics', desc: 'Phân tích mức độ đông/vắng tại sảnh, hành lang, pantry, khu sinh hoạt chung, khu tiếp khách hoặc khu vực công cộng trong tòa nhà.', params: [
        { key: 'zone', label: 'Khu vực giám sát', type: 'zone_hint' },
        { key: 'busyThreshold', label: 'Ngưỡng đông', type: 'number', unit: 'người' },
        { key: 'quietThreshold', label: 'Ngưỡng vắng', type: 'number', unit: 'người', optional: true },
        { key: 'durationMinutes', label: 'Thời gian duy trì để cảnh báo', type: 'number', unit: 'phút' },
        { key: 'reportPeriod', label: 'Khoảng thời gian tổng hợp', type: 'select', options: ['Giờ', 'Ngày', 'Tuần'] },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'], optional: true },
      ]},
      { id: 'bld_meeting_room', name: 'Sử dụng phòng họp', taskMapType: 'counting', desc: 'Theo dõi trạng thái phòng họp đang có người hay trống, phòng bị sử dụng ngoài lịch hoặc số người trong phòng vượt sức chứa.', params: [
        { key: 'zone', label: 'Vùng phòng họp', type: 'zone_hint' },
        { key: 'capacity', label: 'Sức chứa tối đa', type: 'number' },
        { key: 'schedule', label: 'Lịch đặt phòng', type: 'text', optional: true, placeholder: 'Import hoặc danh sách' },
        { key: 'emptyMinutes', label: 'Thời gian phòng trống trước khi ghi nhận', type: 'number', unit: 'phút' },
        { key: 'overtimeMinutes', label: 'Thời gian sử dụng ngoài lịch để cảnh báo', type: 'number', unit: 'phút' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'bld_smoking', name: 'Hút thuốc vùng cấm', taskMapType: 'behavior', desc: 'Phát hiện hành vi hút thuốc trong khu vực cấm như hành lang, thang bộ, nhà vệ sinh, sảnh, phòng kỹ thuật hoặc khu vực văn phòng.', params: [
        { key: 'zone', label: 'Vùng cấm hút thuốc', type: 'zone_hint' },
        { key: 'allowedZone', label: 'Khu vực cho phép hút thuốc', type: 'zone_hint', optional: true },
        { key: 'confirmSeconds', label: 'Thời gian xác nhận', type: 'number', unit: 'giây' },
        { key: 'activeHours', label: 'Khung giờ áp dụng', type: 'time_range' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
      { id: 'bld_reception', name: 'Nhân viên tại quầy lễ tân', taskMapType: 'behavior', desc: 'Phát hiện quầy lễ tân, quầy tiếp khách hoặc quầy dịch vụ không có nhân viên trực trong khung giờ làm việc.', params: [
        { key: 'zone', label: 'Vùng quầy lễ tân', type: 'zone_hint' },
        { key: 'maxAbsenceMinutes', label: 'Thời gian vắng mặt tối đa', type: 'number', unit: 'phút' },
        { key: 'workHours', label: 'Giờ làm việc', type: 'time_range' },
        { key: 'breakHours', label: 'Giờ nghỉ/đổi ca', type: 'time_range', optional: true },
        { key: 'staffAppearance', label: 'Cách nhận diện nhân viên', type: 'select_text', options: ['Đồng phục', 'Thẻ', 'Màu áo'] },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
      ]},
    ]
  },
  {
    key: 'healthcare', name: 'Y tế', color: 'teal',
    useCases: [
      { id: 'hc_fall', name: 'Giám sát bệnh nhân ngã', taskMapType: 'behavior', desc: 'Phát hiện bệnh nhân ngã xuống sàn trong buồng bệnh, hành lang, nhà vệ sinh hoặc khu phục hồi chức năng.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'confirmSeconds', label: 'Xác nhận ngã sau', type: 'number', unit: 'giây' },
        { key: 'excludeZone', label: 'Khu vực giường bệnh (loại trừ)', type: 'zone_hint', optional: true },
        { key: 'alertLevel', label: 'Mức độ ưu tiên cảnh báo', type: 'select', options: ['Thấp', 'Vừa', 'Khẩn'] },
        { key: 'notifyTo', label: 'Người nhận cảnh báo', type: 'text', placeholder: 'VD: điều dưỡng trực / bác sĩ trực' },
      ]},
      { id: 'hc_ppe_sterile', name: 'Tuân thủ trang phục vô khuẩn', taskMapType: 'ppe', desc: 'Phát hiện người không mặc đúng trang phục vô khuẩn vào khu phòng mổ, ICU, phòng sạch.', params: [
        { key: 'zone', label: 'Vùng vô khuẩn', type: 'zone_hint' },
        { key: 'requiredPPE', label: 'Trang phục bắt buộc', type: 'multicheck', options: ['Áo mổ', 'Mũ phẫu thuật', 'Khẩu trang', 'Bao giày'] },
        { key: 'ppeColors', label: 'Màu trang phục vô khuẩn tại cơ sở', type: 'text', placeholder: 'Nhập màu tương ứng mỗi loại' },
        { key: 'exempt', label: 'Ai được miễn', type: 'text', optional: true, placeholder: 'VD: bác sĩ cấp cứu đặc biệt' },
        { key: 'confirmFrames', label: 'Xác nhận sau', type: 'number', unit: 'frame' },
      ]},
      { id: 'hc_restricted', name: 'Xâm nhập khu vực y tế ngoài giờ', taskMapType: 'security', desc: 'Phát hiện người vào khu vực cấm ngoài giờ hành chính: kho thuốc, phòng dược, kho vật tư y tế, phòng hồ sơ.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'workHours', label: 'Giờ làm việc hành chính', type: 'time_range' },
        { key: 'allowedPersonnel', label: 'Người được phép vào ngoài giờ', type: 'text', placeholder: 'VD: bác sĩ trực / dược sĩ trực' },
        { key: 'confirmFrames', label: 'Xác nhận sau', type: 'number', unit: 'frame' },
        { key: 'guardSchedule', label: 'Lịch bảo vệ tuần tra', type: 'text', optional: true, placeholder: 'Danh sách thời gian' },
      ]},
      { id: 'hc_queue', name: 'Giám sát hàng chờ khám', taskMapType: 'counting', desc: 'Phát hiện hàng chờ đăng ký khám, lấy thuốc, xét nghiệm vượt quá ngưỡng số người hoặc thời gian chờ ước tính.', params: [
        { key: 'zone', label: 'Vùng hàng chờ', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số người tối đa trước khi báo', type: 'number' },
        { key: 'maxWaitMinutes', label: 'Thời gian chờ ước tính tối đa', type: 'number', unit: 'phút' },
        { key: 'avgServiceSeconds', label: 'Thời gian phục vụ trung bình mỗi bệnh nhân', type: 'number', unit: 'giây' },
        { key: 'activeCounters', label: 'Số quầy đang mở', type: 'number' },
        { key: 'peakHours', label: 'Giờ cao điểm', type: 'time_range' },
      ]},
      { id: 'hc_hand_hygiene', name: 'Vệ sinh tay trước khi vào phòng bệnh', taskMapType: 'behavior', desc: 'Giám sát nhân viên y tế có rửa tay / xịt cồn tại trạm sát khuẩn trước khi vào phòng bệnh không.', params: [
        { key: 'stationZone', label: 'Vị trí trạm sát khuẩn', type: 'zone_hint' },
        { key: 'doorLine', label: 'Vùng cửa vào phòng bệnh', type: 'line_hint' },
        { key: 'minHygieneSeconds', label: 'Thời gian phải sát khuẩn trước khi vào', type: 'number', unit: 'giây' },
        { key: 'targetTypes', label: 'Áp dụng cho đối tượng nào', type: 'multicheck', options: ['Nhân viên y tế', 'Khách thăm', 'Tất cả'] },
        { key: 'activeHours', label: 'Giờ áp dụng', type: 'time_range' },
      ]},
      { id: 'hc_patient_escape', name: 'Giám sát bệnh nhân bỏ trốn/ rời khu vực', taskMapType: 'security', desc: 'Phát hiện bệnh nhân tâm thần, trẻ em, bệnh nhân ICU rời khỏi khu vực được phép mà không có nhân viên đi kèm.', params: [
        { key: 'allowedZone', label: 'Vùng bệnh nhân được phép ở', type: 'zone_hint' },
        { key: 'patientAppearance', label: 'Đối tượng cần theo dõi', type: 'text', placeholder: 'Mô tả trang phục/màu áo bệnh nhân' },
        { key: 'staffAppearance', label: 'Nhân viên đi kèm nhận diện thế nào', type: 'text', placeholder: 'VD: đồng phục trắng' },
        { key: 'confirmSeconds', label: 'Thời gian rời khu vực mới báo', type: 'number', unit: 'giây' },
        { key: 'transitZone', label: 'Vùng cho phép ra ngoài có nhân viên đi kèm', type: 'zone_hint', optional: true },
      ]},
      { id: 'hc_crowd_restricted', name: 'Phát hiện tụ tập đông người trong khu vực hạn chế', taskMapType: 'security', desc: 'Phát hiện tụ tập nhiều người trong khu vực hạn chế số lượng: ICU, phòng hồi sức, phòng cách ly.', params: [
        { key: 'zone', label: 'Vùng hạn chế', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số người tối đa cho phép', type: 'number' },
        { key: 'confirmSeconds', label: 'Thời gian vượt ngưỡng trước khi báo', type: 'number', unit: 'giây' },
        { key: 'visitingHours', label: 'Giờ cho phép vào thăm', type: 'time_range' },
        { key: 'exempt', label: 'Ai được miễn', type: 'text', optional: true, placeholder: 'VD: nhân viên y tế' },
      ]},
      { id: 'hc_ppe_medical', name: 'Thiếu trang bị bảo hộ y tế', taskMapType: 'ppe', desc: 'Phát hiện nhân viên y tế, hộ lý thiếu PPE y tế bắt buộc khi vào khu nguy hiểm lây nhiễm.', params: [
        { key: 'zone', label: 'Vùng cần PPE y tế', type: 'zone_hint' },
        { key: 'requiredPPE', label: 'PPE bắt buộc', type: 'multicheck', options: ['Khẩu trang N95', 'Tấm chắn mặt', 'Găng tay', 'Áo cách ly'] },
        { key: 'ppeColors', label: 'Màu PPE tại cơ sở', type: 'text', placeholder: 'Nhập màu tương ứng mỗi loại' },
        { key: 'exempt', label: 'Ai được miễn', type: 'text', optional: true },
        { key: 'confirmFrames', label: 'Xác nhận sau', type: 'number', unit: 'frame' },
        { key: 'graceSeconds', label: 'Grace period tháo PPE tạm', type: 'number', unit: 'giây' },
      ]},
    ]
  },
  {
    key: 'education', name: 'Giáo dục', color: 'fuchsia',
    useCases: [
      { id: 'edu_leave', name: 'Học sinh rời khu vực trong giờ học', taskMapType: 'security', desc: 'Phát hiện học sinh rời khỏi khuôn viên trường hoặc khu vực lớp học trong giờ học mà không có phép.', params: [
        { key: 'allowedZone', label: 'Vùng cho phép học sinh ở lại', type: 'zone_hint' },
        { key: 'forbiddenLine', label: 'Cổng/lối ra học sinh không được phép', type: 'line_hint' },
        { key: 'schoolHours', label: 'Giờ học', type: 'time_range' },
        { key: 'allowedPersonnel', label: 'Ai được ra ngoài', type: 'text', placeholder: 'VD: giáo viên, bảo vệ, nhân viên' },
        { key: 'confirmSeconds', label: 'Xác nhận sau', type: 'number', unit: 'giây' },
      ]},
      { id: 'edu_violence', name: 'Phát hiện ẩu đả, bạo lực học đường', taskMapType: 'behavior', desc: 'Phát hiện hành vi ẩu đả, đánh nhau, bắt nạt giữa học sinh tại hành lang, nhà vệ sinh, sân trường, góc khuất.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'minPeople', label: 'Số người tối thiểu liên quan', type: 'number' },
        { key: 'confirmSeconds', label: 'Thời gian hành vi bất thường liên tục', type: 'number', unit: 'giây' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Theo dõi', 'Cảnh báo', 'Khẩn cấp'] },
        { key: 'activeHours', label: 'Giờ áp dụng (giờ ra chơi, tan học)', type: 'time_range' },
      ]},
      { id: 'edu_attendance', name: 'Giám sát sĩ số học sinh', taskMapType: 'counting', desc: 'Tự động đếm số học sinh vào/ra lớp, phát hiện thiếu sĩ số so với đăng ký hoặc học sinh vào nhầm lớp.', params: [
        { key: 'doorLine', label: 'Vùng cửa vào lớp', type: 'line_hint' },
        { key: 'standardClassSize', label: 'Sĩ số chuẩn của lớp', type: 'number' },
        { key: 'alertThreshold', label: 'Cảnh báo khi thiếu bao nhiêu học sinh', type: 'number' },
        { key: 'attendanceTime', label: 'Giờ điểm danh', type: 'time_range' },
        { key: 'checkAfterMinutes', label: 'Thời gian sau khi bắt đầu tiết mới kiểm tra', type: 'number', unit: 'phút' },
      ]},
      { id: 'edu_cheating', name: 'Phát hiện hành vi gian lận thi cử', taskMapType: 'behavior', desc: 'Giám sát phòng thi, phát hiện học sinh nhìn bài nhau, trao đổi tài liệu, sử dụng điện thoại trong giờ thi.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'examHours', label: 'Giờ thi', type: 'time_range' },
        { key: 'detectPhone', label: 'Phát hiện sử dụng điện thoại', type: 'toggle' },
        { key: 'detectLooking', label: 'Phát hiện quay sang người bên cạnh', type: 'toggle' },
        { key: 'violationCount', label: 'Số lần vi phạm trước khi báo', type: 'number' },
        { key: 'violationDuration', label: 'Thời gian vi phạm tối thiểu', type: 'number', unit: 'giây' },
      ]},
      { id: 'edu_traffic', name: 'An toàn khu vực cổng trường giờ tan học', taskMapType: 'traffic', desc: 'Giám sát mật độ người và phương tiện trước cổng trường giờ tan học, phát hiện xe vào sai khu vực đón trả.', params: [
        { key: 'gateZone', label: 'Vùng cổng trường', type: 'zone_hint' },
        { key: 'noParkingZone', label: 'Vùng cấm đỗ xe đón trả', type: 'zone_hint' },
        { key: 'maxParkingMinutes', label: 'Thời gian đỗ tối đa', type: 'number', unit: 'phút' },
        { key: 'maxDensity', label: 'Mật độ người tối đa', type: 'number' },
        { key: 'dismissalHours', label: 'Giờ tan học', type: 'time_range' },
        { key: 'vehicleTypes', label: 'Loại phương tiện giám sát', type: 'multicheck', options: ['Xe máy', 'Ô tô'] },
      ]},
      { id: 'edu_recess', name: 'Giám sát học sinh trong giờ nghỉ', taskMapType: 'security', desc: 'Đảm bảo học sinh ở đúng khu vực được phép trong giờ ra chơi, phát hiện học sinh vào khu vực cấm (mái, kho, phòng kỹ thuật).', params: [
        { key: 'allowedZone', label: 'Vùng học sinh được phép vui chơi', type: 'zone_hint' },
        { key: 'forbiddenZone', label: 'Vùng cấm học sinh', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng cấm"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'recessHours', label: 'Giờ ra chơi', type: 'time_range' },
        { key: 'confirmSeconds', label: 'Xác nhận sau', type: 'number', unit: 'giây' },
        { key: 'appearance', label: 'Nhận diện học sinh', type: 'text', placeholder: 'VD: đồng phục màu trắng' },
      ]},
      { id: 'edu_weapons', name: 'Phát hiện vật nguy hiểm trong trường', taskMapType: 'security', desc: 'Phát hiện học sinh mang vũ khí, vật sắc nhọn, hoặc mang theo đồ vật không phù hợp vào trường.', params: [
        { key: 'zone', label: 'Vùng giám sát', type: 'zone_hint' },
        { key: 'targets', label: 'Đối tượng cần phát hiện', type: 'multicheck', options: ['Dao', 'Vũ khí', 'Gậy', 'Bình xịt'] },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Theo dõi', 'Khẩn cấp'] },
        { key: 'confirmFrames', label: 'Xác nhận sau', type: 'number', unit: 'frame' },
      ]},
    ]
  },
  {
    key: 'transport', name: 'Sân bay/ga tàu', color: 'sky',
    useCases: [
      { id: 'ap_queue', name: 'Hàng chờ check-in/ Quản lý đám đông', taskMapType: 'counting', desc: 'Quản lý mật độ, số lượng và thời gian chờ tại các khu vực tập trung đông người.', params: [
        { key: 'zone', label: 'Vùng giám sát hàng chờ', type: 'zone_hint' },
        { key: 'maxPeople', label: 'Số lượng người tối đa cho phép trong vùng', type: 'number' },
        { key: 'maxWaitMinutes', label: 'Thời gian chờ trung bình vượt mức', type: 'number', unit: 'phút' },
        { key: 'densityThreshold', label: 'Ngưỡng cảnh báo mật độ đám đông', type: 'slider_pct' },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Thấp', 'Trung bình', 'Cao'] },
        { key: 'activeHours', label: 'Khung giờ áp dụng', type: 'time_range' },
        { key: 'reportInterval', label: 'Chu kỳ gửi báo cáo thống kê', type: 'select', options: ['15 phút', '30 phút', '1 giờ'] },
      ]},
      { id: 'ap_abandoned_baggage', name: 'Hành lý bỏ quên', taskMapType: 'security', desc: 'Phát hiện hành lý, vật thể bị bỏ rơi tại sảnh, phòng chờ quá thời gian quy định.', params: [
        { key: 'zone', label: 'Vùng giám sát hành lý', type: 'zone_hint' },
        { key: 'minSizePct', label: 'Kích thước vật thể tối thiểu cần phát hiện', type: 'slider_pct' },
        { key: 'idleSeconds', label: 'Thời gian vật thể không di chuyển mới báo động', type: 'number', unit: 'giây' },
        { key: 'maxDistance', label: 'Khoảng cách tối đa từ chủ nhân đến hành lý', type: 'number', unit: 'mét' },
        { key: 'excludeObjects', label: 'Phân loại đối tượng loại trừ', type: 'multicheck', options: ['Thùng rác cố định', 'Xe đẩy', 'Cột chắn'] },
        { key: 'alertLevel', label: 'Mức độ cảnh báo', type: 'select', options: ['Trung bình', 'Khẩn cấp'] },
      ]},
      { id: 'ap_restricted', name: 'Xâm nhập khu vực hạn chế', taskMapType: 'security', desc: 'Kiểm soát truy cập vào các khu vực cấm hoặc vùng kiểm soát an ninh.', params: [
        { key: 'zone', label: 'Vùng cấm/Khu vực hạn chế', type: 'zone_hint' },
        { key: 'zoneCondition', label: 'Khi nào tính là "đã vào vùng"', type: 'card2', options: ['Tâm đối tượng nằm trong vùng (chính xác hơn)', 'Bất kỳ phần nào chạm viền (nhạy hơn)'] },
        { key: 'earlyWarningLine', label: 'Đường ranh giới cảnh báo sớm', type: 'line_hint' },
        { key: 'direction', label: 'Hướng xâm nhập', type: 'multicheck', options: ['Vào', 'Ra', 'Cả hai'] },
        { key: 'allowedObjects', label: 'Đối tượng được phép ngoại trừ', type: 'multicheck', options: ['Nhân viên mặc đồng phục', 'Xe chuyên dụng', 'Xe kéo hành lý'] },
        { key: 'maxStaySeconds', label: 'Thời gian lưu lại vùng cấm tối đa', type: 'number', unit: 'giây' },
        { key: 'wrongWayAlert', label: 'Cảnh báo đi ngược chiều (hải quan/cửa ra)', type: 'toggle' },
      ]},
      { id: 'ap_baggage_carousel', name: 'Băng chuyền hành lý', taskMapType: 'behavior', desc: 'Giám sát hoạt động của băng chuyền, phát hiện kẹt, quá tải hoặc hành vi bất thường.', params: [
        { key: 'zone', label: 'Vùng giám sát mặt băng chuyền', type: 'zone_hint' },
        { key: 'jamSeconds', label: 'Phát hiện tình trạng kẹt/ùn ứ hành lý (không di chuyển)', type: 'number', unit: 'giây' },
        { key: 'idleMinutes', label: 'Phát hiện băng chuyền chạy không tải quá lâu', type: 'number', unit: 'phút' },
        { key: 'detectClimbing', label: 'Phát hiện hành vi sai (Người trèo/ngồi lên)', type: 'toggle' },
        { key: 'oversizedAlert', label: 'Cảnh báo hành lý quá khổ rơi ra ngoài', type: 'toggle' },
        { key: 'activeHours', label: 'Khung giờ hoạt động của băng chuyền', type: 'time_range' },
      ]},
      { id: 'ap_weapon', name: 'Phát hiện vũ khí, hung khí nguy hiểm', taskMapType: 'security', desc: 'Nhận diện hình ảnh vũ khí trước khu vực soi chiếu hoặc sảnh công cộng.', params: [
        { key: 'zone', label: 'Vùng giám sát trọng điểm', type: 'zone_hint' },
        { key: 'weaponTypes', label: 'Loại vũ khí cần nhận diện', type: 'multicheck', options: ['Súng ngắn', 'Súng trường', 'Dao, kiếm', 'Gậy gộc'] },
        { key: 'confidencePct', label: 'Độ tự tin tối thiểu để báo động', type: 'slider_pct' },
        { key: 'silentAlarm', label: 'Lưu vết và gửi cảnh báo khẩn cấp (Silent Alarm)', type: 'toggle' },
      ]},
      { id: 'ap_safety_line', name: 'Cảnh báo vượt đường vạch vàng an toàn', taskMapType: 'security', desc: 'Cảnh báo hành khách lấn qua vạch an toàn tại ga tàu hỏa, tàu điện ngầm.', params: [
        { key: 'safetyLine', label: 'Đường ranh giới vạch vàng (Safety Line)', type: 'line_hint' },
        { key: 'violationSeconds', label: 'Thời gian lấn vạch liên tục để báo động', type: 'number', unit: 'giây' },
        { key: 'autoSpeaker', label: 'Kích hoạt hệ thống loa phát thanh nhắc nhở', type: 'toggle' },
        { key: 'linkTrainSignal', label: 'Loại trừ khi tàu đã dừng và mở cửa', type: 'toggle' },
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
  const [monitoringMode, setMonitoringMode] = useState<'standard' | 'smart' | 'defect_detection'>('smart');
  const [inferredMode, setInferredMode] = useState<'standard' | 'smart' | 'defect_detection'>('smart');
  const [userDescription, setUserDescription] = useState('');
  const [routedModelName, setRoutedModelName] = useState('YOLO-NAS-S');
  const [routedModelReason, setRoutedModelReason] = useState('Mặc định');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'whole_scene' | 'roi'>('whole_scene');

  // Standard config
  const [standardFunction, setStandardFunction] = useState<'security' | 'counting'>('security');
  const [detectionTarget, setDetectionTarget] = useState('person');
  const [customTarget, setCustomTarget] = useState('');
  const [detectionRule, setDetectionRule] = useState('enter_area');
  const [alertDuration, setAlertDuration] = useState(10);
  const [alertCount, setAlertCount] = useState(1);
  const [cooldown, setCooldown] = useState(60);
  const [confidence, setConfidence] = useState(0.65);
  const [iou, setIou] = useState(0.45);
  const [tracker, setTracker] = useState('bytetrack');
  const [frameSkip, setFrameSkip] = useState(0);
  const [inferenceFps, setInferenceFps] = useState(15);
  const [maxLimit, setMaxLimit] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.78);
  const [retrievalTopK, setRetrievalTopK] = useState(5);

  // Task-specific
  const [countingDirection, setCountingDirection] = useState<'in' | 'out' | 'both'>('both');
  const [ppeItems, setPpeItems] = useState({ hardhat: true, vest: true, glove: false, mask: false });
  const [fireSensitivity, setFireSensitivity] = useState<'low' | 'medium' | 'high'>('high');
  const [behaviorItems, setBehaviorItems] = useState({ fall: false, violence: false, crowd: false, smoking: false, phone: false, weapon: false });
  const [retailMode, setRetailMode] = useState<'heatmap' | 'demographics'>('heatmap');

  // Zone spatial condition: 'inside' = center of bbox in polygon; 'intersect' = bbox edge touches polygon
  const [zoneCondition, setZoneCondition] = useState<'inside' | 'intersect'>('inside');

  // Counting: reference product image (only count this product)
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
  const [useCaseImages, setUseCaseImages] = useState<string[]>([]);
  const [useCaseImageROIs, setUseCaseImageROIs] = useState<Record<number, BoundingBox[]>>({});

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
  const [ruleCondition, setRuleCondition] = useState('count_lt_min');

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
    setMonitoringMode('smart');
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
  };

  const inferMonitoringConfig = (text: string, hasRoi: boolean): InferredMonitoringConfig => {
    const lw = text.toLowerCase();
    const hasPpe = ['mũ', 'áo phản quang', 'bảo hộ', 'ppe', 'an toàn'].some(k => lw.includes(k));
    const hasVehicle = ['xe', 'ô tô', 'oto', 'xe máy', 'motorcycle', 'truck', 'tải'].some(k => lw.includes(k));
    const hasPerson = ['người', 'khách', 'nhân viên', 'công nhân', 'person'].some(k => lw.includes(k));
    const asksCount = ['đếm', 'số lượng', 'bao nhiêu', 'count'].some(k => lw.includes(k));
    const usesLine = ['vào ra', 'ra vào', 'đi qua', 'qua cổng', 'cross', 'line'].some(k => lw.includes(k));
    const usesExit = ['rời khỏi', 'đi ra', 'exit'].some(k => lw.includes(k));
    const usesIntrusion = ['xâm nhập', 'đi vào', 'vào khu vực', 'enter'].some(k => lw.includes(k));
    const usesLoiter = ['lảng vảng', 'ở lại lâu', 'loiter', 'quá lâu'].some(k => lw.includes(k));
    const hasDefect = ['lỗi', 'móp', 'rách', 'xước', 'hỏng', 'defect'].some(k => lw.includes(k));
    const hasAbandoned = ['bỏ lại', 'leaving', 'balo', 'ba lô', 'túi'].some(k => lw.includes(k));
    const hasRemoval = ['lấy hàng', 'lấy khỏi', 'remove'].some(k => lw.includes(k));
    const usesKnownTarget = hasPerson || hasVehicle;
    const needsOpen = hasPpe || hasDefect || hasAbandoned || hasRemoval || (!usesKnownTarget && text.trim().length > 0);

    if (!needsOpen && usesKnownTarget) {
      const target = hasVehicle ? 'vehicle' : 'person';
      const rule = usesLine ? 'cross_line' : usesExit ? 'exit_area' : usesIntrusion ? 'enter_area' : usesLoiter ? 'loitering' : asksCount ? 'object_counting' : 'appear';
      return {
        mode: 'standard', model: 'YOLO-NAS-S', target, rule,
        scope: hasRoi ? 'roi' : 'whole_scene',
        countingType: usesLine || rule === 'cross_line' ? 'line' : 'zone',
        config: { alertDuration: usesLoiter ? 60 : 10, alertCount: asksCount ? maxLimit : 1, cooldown: lw.includes('ngay') ? 15 : 60, confidence: 0.65, iou: 0.45, tracker: 'bytetrack', frameSkip: usesLine ? 0 : 1, inferenceFps: 15 },
      };
    }

    const rule = hasPpe ? 'safety_violation' : hasDefect ? 'defect_detected' : hasAbandoned ? 'abandoned_object' : hasRemoval ? 'object_removed' : usesIntrusion ? 'enter_area' : asksCount ? 'object_counting' : 'semantic_match';
    return {
      mode: 'smart',
      model: hasPpe ? 'YOLO-NAS + LocateAnything (Crop Mode)' : 'LocateAnything-3B',
      rule, scope: hasRoi ? 'roi' : 'whole_scene', countingType: 'zone',
      searchQuery: hasPpe ? 'người không đội mũ bảo hộ, người không mặc áo phản quang' : text,
      config: { similarityThreshold: hasDefect ? 0.82 : 0.78, retrievalTopK: hasRoi ? 5 : 8, cooldown: lw.includes('ngay') ? 15 : 60, alertDuration: usesLoiter ? 60 : 10, alertCount: asksCount ? maxLimit : 1 },
    };
  };

  const handleDescriptionChange = (text: string) => {
    setUserDescription(text);
    if (!text.trim()) { setRoutedModelName('Chưa xác định'); setRoutedModelReason('Vui lòng mô tả yêu cầu.'); return; }
    const inferred = inferMonitoringConfig(text, drawingPoints.length > 0 || currentCamZones.length > 0);
    setInferredMode(inferred.mode);
    setRoutedModelName(inferred.model);
    setRoutedModelReason(inferred.mode === 'standard' ? 'Tự suy luận cấu hình YOLO chuẩn từ mô tả.' : 'Tự suy luận LocateAnything từ ngôn ngữ tự nhiên.');
    setRuleCondition(inferred.rule);
    setSearchScope(inferred.scope);
    setSearchQuery(inferred.searchQuery || '');
    if (inferred.mode === 'standard') {
      setDetectionTarget(inferred.target || 'person');
      setConfidence(Number(inferred.config.confidence || 0.65));
      setIou(Number(inferred.config.iou || 0.45));
      setTracker(String(inferred.config.tracker || 'bytetrack'));
      setFrameSkip(Number(inferred.config.frameSkip || 0));
      setInferenceFps(Number(inferred.config.inferenceFps || 15));
    } else {
      setSimilarityThreshold(Number(inferred.config.similarityThreshold || 0.78));
      setRetrievalTopK(Number(inferred.config.retrievalTopK || 5));
    }
    setDetectionRule(inferred.rule);
    setAlertDuration(Number(inferred.config.alertDuration || 10));
    setAlertCount(Number(inferred.config.alertCount || 1));
    setCooldown(Number(inferred.config.cooldown || 60));
  };

  const applyTemplate = (tpl: any) => {
    handleDescriptionChange(tpl.description || '');
    if (tpl.ruleCondition) setRuleCondition(tpl.ruleCondition);
  };

  const hydratePipelineForEdit = (pipe: Pipeline) => {
    setEditingPipelineId(pipe.id);
    setSelectedCameraIds([pipe.cameraId]);
    setFlowName(pipe.name);
    setMonitoringMode(pipe.monitoringMode || 'smart');
    setUserDescription(pipe.description || pipe.searchQuery || '');
    setRoutedModelName(pipe.detectorName || 'Chưa xác định');
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

    if (pipe.monitoringMode === 'standard') {
      setDetectionTarget(pipe.detectionTarget || 'person');
      if (pipe.detectionRule === 'object_counting') { setStandardFunction('counting'); setDetectionRule('object_counting'); }
      else { setStandardFunction('security'); setDetectionRule(pipe.detectionRule || 'enter_area'); }
      setAlertDuration(Number(pipe.config?.alertDuration || 10));
      setAlertCount(Number(pipe.config?.alertCount || 1));
      setCooldown(Number(pipe.config?.cooldown || 60));
      setConfidence(Number(pipe.config?.confidence || 0.65));
      setIou(Number(pipe.config?.iou || 0.45));
      setTracker(String(pipe.config?.tracker || 'bytetrack'));
      setFrameSkip(Number(pipe.config?.frameSkip || 0));
      setInferenceFps(Number(pipe.config?.inferenceFps || 15));
      setZoneCondition((pipe.config?.zoneCondition as 'inside' | 'intersect') || 'inside');
      setCountingProductImage((pipe.config?.countingProductImage as string) || null);
    } else if (pipe.monitoringMode === 'smart') {
      setSimilarityThreshold(Number(pipe.config?.similarityThreshold || 0.78));
      setRetrievalTopK(Number(pipe.config?.retrievalTopK || 5));
      setCooldown(Number(pipe.config?.cooldown || 60));
      if (pipe.config?.aiContext) setAiContext(pipe.config.aiContext as { environment: string; normalBehavior: string; specialNotes: string });
    } else if (pipe.monitoringMode === 'defect_detection') {
      setGoldenSamples((pipe.config?.goldenSamples as unknown) as string[] || []);
      setEnableSSIM(Boolean(pipe.config?.enableSSIM ?? true));
      setEnableCNN(Boolean(pipe.config?.enableCNN ?? false));
      setEnableOCR(Boolean(pipe.config?.enableOCR ?? false));
      setExpectedOCRText(String(pipe.config?.expectedOCRText || ''));
      setDefectSensitivity(pipe.config?.defectSensitivity as 'low' | 'medium' | 'high' || 'medium');
      setInspectionROIs((pipe.config?.inspectionROIs as unknown) as Record<number, BoundingBox[]> || {});
    }
    setCurrentStep('task');
  };

  const handleNext = () => {
    if (currentStep === 'task' && taskType.startsWith('defect_')) {
      setMonitoringMode('defect_detection');
    }
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

      const ucExtra = selectedUseCaseDef ? {
        useCaseId: selectedUseCaseDef.id,
        useCaseName: selectedUseCaseDef.name,
        useCaseParams: Object.keys(useCaseParamValues).length > 0 ? useCaseParamValues : undefined,
        useCaseImages: useCaseImages.length > 0 ? useCaseImages : undefined,
        useCaseImageROIs: Object.keys(useCaseImageROIs).length > 0 ? useCaseImageROIs : undefined,
      } : {};

      if (monitoringMode === 'standard') {
        finalTarget = detectionTarget === 'custom' ? customTarget : detectionTarget;
        finalRule = detectionRule;
        finalConfig = { alertDuration, alertCount, cooldown, confidence, iou, tracker, frameSkip, inferenceFps, zoneCondition, countingProductImage: countingProductImage || undefined, ...ucExtra };
      } else if (monitoringMode === 'smart') {
        finalRule = ruleCondition;
        finalConfig = { similarityThreshold, retrievalTopK, cooldown, alertDuration, inferenceFps, aiContext: (aiContext.environment || aiContext.normalBehavior || aiContext.specialNotes) ? aiContext : undefined, ...ucExtra };
      } else {
        finalRule = 'defect_detected';
        finalConfig = { goldenSamples: useCaseImages.length > 0 ? useCaseImages : goldenSamples, inspectionROIs, enableSSIM, enableCNN, enableOCR, expectedOCRText, alertDuration, alertCount, cooldown, inferenceFps, ...ucExtra };
      }

      return {
        id: editingPipelineId || `pipe-${Date.now()}-${cameraId}`,
        name: flowName.trim() || `Luồng giám sát - ${cam?.name.split(' ')[1] || 'Camera'}`,
        cameraId,
        detectorName: monitoringMode === 'standard'
          ? (STANDARD_MODEL_NAMES[taskType] || 'YOLO-NAS-S')
          : monitoringMode === 'defect_detection'
          ? `CNN Defect Inspector${enableOCR ? ' + OCR' : ''}${enableCNN ? ' + CNN' : ''}`
          : (routedModelName || 'LocateAnything-3B'),
        monitoringMode,
        detectionTarget: finalTarget,
        detectionRule: finalRule,
        searchScope,
        config: finalConfig,
        searchQuery: monitoringMode === 'smart' ? searchQuery : undefined,
        description: monitoringMode === 'smart' ? userDescription : undefined,
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
                              <span className="mt-1 inline-block text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{TASK_LABELS[pipe.monitoringMode || ''] || pipe.monitoringMode}</span>
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
            <div className="space-y-4">
              {/* Domain strip */}
              <div className="flex gap-2 flex-wrap">
                {DOMAINS.map(domain => {
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  const isActive = selectedDomain === domain.key;
                  return (
                    <button
                      key={domain.key}
                      onClick={() => { setSelectedDomain(isActive ? '' : domain.key); }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer ${isActive ? `${c.activeBg} ${c.activeText} border-transparent shadow-md` : `bg-white ${c.text} ${c.border} hover:${c.bg}`}`}
                    >
                      {domain.key === 'security' && <Shield size={14} />}
                      {domain.key === 'traffic' && <Car size={14} />}
                      {domain.key === 'production' && <Cpu size={14} />}
                      {domain.key === 'safety' && <HardHat size={14} />}
                      {domain.key === 'fire' && <Flame size={14} />}
                      {domain.key === 'retail' && <Store size={14} />}
                      {domain.key === 'warehouse' && <Package size={14} />}
                      {domain.name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25 text-white' : c.badge}`}>{domain.useCases.length}</span>
                    </button>
                  );
                })}
              </div>

              {/* Use case list */}
              {selectedDomain && (() => {
                const domain = DOMAINS.find(d => d.key === selectedDomain)!;
                const c = DOMAIN_COLOR_MAP[domain.color];
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className={`px-5 py-3 border-b border-slate-100 flex items-center gap-2 ${c.bg}`}>
                      <span className={`text-xs font-bold ${c.text}`}>{domain.name}</span>
                      <span className="text-xs text-slate-400">— chọn bài toán cụ thể</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {domain.useCases.map(uc => {
                        const isSelected = selectedUseCaseDef?.id === uc.id;
                        const hasImage = uc.needsImage;
                        return (
                          <button
                            key={uc.id}
                            onClick={() => {
                              setSelectedUseCaseDef(isSelected ? null : uc);
                              setTaskType(uc.taskMapType);
                              if (!isSelected) {
                                setUseCaseParamValues({});
                                setUseCaseImages([]);
                              }
                            }}
                            className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${isSelected ? `${c.bg}` : 'hover:bg-slate-50'}`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? `${c.activeBg} border-transparent` : 'border-slate-300'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-bold ${isSelected ? c.text : 'text-slate-700'}`}>{uc.name}</div>
                              {uc.desc && <p className={`text-[10px] mt-0.5 ${isSelected ? c.text.replace('700', '500') : 'text-slate-500'}`}>{uc.desc}</p>}
                              {hasImage && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.badge}`}>📷 Cần ảnh mẫu</span>
                                </div>
                              )}
                            </div>
                            {isSelected && <Check size={16} className={c.text} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Selected use case chip */}
              {selectedUseCaseDef && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <Check size={16} className="text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-emerald-800">{selectedUseCaseDef.name}</span>
                    <span className="text-xs text-emerald-600 ml-2">· Tiếp tục để cấu hình tham số →</span>
                  </div>
                  <button onClick={() => { setSelectedUseCaseDef(null); setUseCaseParamValues({}); setUseCaseImages([]); }} className="text-emerald-400 hover:text-rose-500 cursor-pointer transition-colors"><X size={14} /></button>
                </div>
              )}

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
                {/* Left: AI mode + params + FPS */}
                <div className="lg:col-span-7 space-y-4">

                  {/* ── Use-case specific param form (only when selected from domain browser) ── */}
                  {selectedUseCaseDef && (() => {
                    const uc = selectedUseCaseDef;
                    const domainDef = DOMAINS.find(d => d.useCases.some(u => u.id === uc.id));
                    const c = domainDef ? DOMAIN_COLOR_MAP[domainDef.color] : DOMAIN_COLOR_MAP['emerald'];

                    const renderParam = (param: UCParam) => {
                      if (param.condition && !param.condition(useCaseParamValues)) return null;
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

                        {/* Optional params in collapsible */}
                        {optionalParams.length > 0 && (
                          <details className="group">
                            <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                              <ChevronRight size={12} className="group-open:rotate-90 transition-transform flex-shrink-0" />
                              Tham số tuỳ chọn ({optionalParams.length})
                              <span className="font-normal normal-case text-slate-300 ml-1">giúp AI chính xác hơn</span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              {optionalParams.map(renderParam)}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}

                  {/* Mode selection */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Công nghệ AI</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setMonitoringMode('standard')}
                        className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${monitoringMode === 'standard' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sliders size={16} className={monitoringMode === 'standard' ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className={`text-sm font-bold ${monitoringMode === 'standard' ? 'text-emerald-800' : 'text-slate-700'}`}>Tiêu chuẩn</span>
                          {monitoringMode === 'standard' && <Check size={14} className="text-emerald-600 ml-auto" />}
                        </div>
                        <p className="text-[10px] text-slate-500">Quy tắc cố định, nhanh, thích hợp bài toán thông dụng.</p>
                      </button>
                      <button
                        onClick={() => setMonitoringMode('smart')}
                        className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${monitoringMode === 'smart' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles size={16} className={monitoringMode === 'smart' ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className={`text-sm font-bold ${monitoringMode === 'smart' ? 'text-emerald-800' : 'text-slate-700'}`}>Thông minh</span>
                          {monitoringMode === 'smart' && <Check size={14} className="text-emerald-600 ml-auto" />}
                        </div>
                        <p className="text-[10px] text-slate-500">AI hiểu ngôn ngữ tự nhiên, linh hoạt với mọi yêu cầu.</p>
                      </button>
                    </div>
                  </div>

                  {/* Task-specific params */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tham số phát hiện</label>

                    {monitoringMode === 'smart' ? (
                      <>
                        <textarea
                          value={userDescription} onChange={e => handleDescriptionChange(e.target.value)}
                          placeholder='Mô tả bằng tiếng Việt: "Cảnh báo khi có người xâm nhập khu vực cấm sau 22h"'
                          className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 resize-none"
                        />
                        {/* Task-specific quick suggestions */}
                        {(() => {
                          const suggestions = selectedUseCaseDef && TASK_SMART_SUGGESTIONS[selectedUseCaseDef.id] 
                            ? TASK_SMART_SUGGESTIONS[selectedUseCaseDef.id] 
                            : TASK_SMART_SUGGESTIONS[taskType];
                          if (!suggestions) return null;
                          return (
                            <details className="group" defaultOpen>
                              <summary className="text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 list-none flex items-center gap-1.5 select-none">
                                <ChevronRight size={12} className="group-open:rotate-90 transition-transform flex-shrink-0" />
                                Gợi ý nhanh
                              </summary>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {suggestions.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => handleDescriptionChange(s.description)}
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

                        {/* Sensitivity selector */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Độ nhạy phát hiện</label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: 0.65, label: 'Rộng', desc: 'Bắt nhiều hơn, có thể có báo nhầm' },
                              { value: 0.78, label: 'Cân bằng', desc: 'Đề xuất cho hầu hết nghiệp vụ', recommended: true },
                              { value: 0.88, label: 'Chính xác', desc: 'Ít báo nhầm, có thể bỏ sót nhẹ' },
                            ] as const).map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setSimilarityThreshold(opt.value)}
                                className={`relative p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${similarityThreshold === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                              >
                                {(opt as any).recommended && similarityThreshold !== opt.value && (
                                  <span className="absolute -top-2 left-2 text-[8px] bg-slate-700 text-white px-1.5 py-0.5 rounded font-bold">Đề xuất</span>
                                )}
                                <p className={`text-xs font-bold ${similarityThreshold === opt.value ? 'text-emerald-700' : 'text-slate-700'}`}>{opt.label}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Timing params */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Xác nhận sự kiện sau</label>
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} value={alertDuration} onChange={e => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                              <span className="text-xs text-slate-400 whitespace-nowrap">giây</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">Phải diễn ra liên tục bao lâu trước khi báo</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                            <div className="flex items-center gap-2">
                              <input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                              <span className="text-xs text-slate-400 whitespace-nowrap">giây</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">Chờ bao lâu trước khi cho phép báo tiếp</p>
                          </div>
                        </div>

                        {/* Ngữ cảnh AI đã được gỡ bỏ theo yêu cầu */}
                      </>
                    ) : (
                      <>
                        {(taskType === 'security' || taskType === 'counting') && (
                          <>
                            {!(['sec_camera_tamper', 'sec_wrong_way', 'sec_abandoned_object', 'sec_door_abnormal', 'bld_restricted', 'sec_loitering'].includes(selectedUseCaseDef?.id || '')) && (
                              <>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đối tượng phát hiện</label>
                                  {(() => {
                                    const isProductCounting = selectedUseCaseDef?.id === 'prd_counting' || selectedUseCaseDef?.id === 'wh_counting';
                                    const isPeopleCounting = selectedUseCaseDef?.id === 'ret_counting' || selectedUseCaseDef?.id === 'ret_queue';
                                    return (
                                      <select value={detectionTarget} onChange={e => setDetectionTarget(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                        {/* People (shown for general + retail counting; hidden for product/item counting) */}
                                        {!isProductCounting && <option value="person">Người</option>}
                                        {/* Vehicles (hidden for product counting and retail people counting) */}
                                        {!isProductCounting && !isPeopleCounting && <option value="vehicle">Phương tiện (chung)</option>}
                                        {!isProductCounting && !isPeopleCounting && <option value="motorcycle">Xe máy</option>}
                                        {!isProductCounting && !isPeopleCounting && <option value="truck">Xe tải / Xe buýt</option>}
                                        {!isProductCounting && !isPeopleCounting && <option value="bicycle">Xe đạp</option>}
                                        {/* Forklift — industrial, shown unless retail people counting */}
                                        {!isPeopleCounting && <option value="forklift">Xe nâng</option>}
                                        {/* Products — only for counting tasks and not for retail people counting */}
                                        {taskType === 'counting' && !isPeopleCounting && <option value="package">Hàng hoá / Thùng hộp</option>}
                                        {!isProductCounting && !isPeopleCounting && <option value="pet">Thú cưng / Động vật</option>}
                                        {!isPeopleCounting && <option value="unknown_object">Vật thể không xác định</option>}
                                        <option value="custom">Tuỳ chỉnh...</option>
                                      </select>
                                    );
                                  })()}
                                </div>
                                {detectionTarget === 'custom' && (
                                  <input type="text" value={customTarget} onChange={e => setCustomTarget(e.target.value)} placeholder="VD: box, helmet, forklift" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm mt-2" />
                                )}
                              </>
                            )}
                            {taskType === 'security' && (
                              <>
                                {/* When a specific use case is selected from domain browser, the rule is implicit — hide the dropdown */}
                                {!selectedUseCaseDef && (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Luật cảnh báo</label>
                                  <select value={detectionRule} onChange={e => setDetectionRule(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                    <option value="enter_area">Xâm nhập vùng cấm</option>
                                    <option value="exit_area">Rời khỏi khu vực</option>
                                    <option value="cross_line">Vượt ranh giới / Vạch ảo</option>
                                    <option value="appear">Xuất hiện đột ngột</option>
                                    <option value="disappear">Vật thể rời vị trí / Vật thể bị lấy đi</option>
                                    <option value="loitering">Dừng đỗ / Lảng vảng lâu</option>
                                    <option value="crowd_gathering">Tụ tập đông người</option>
                                  </select>
                                </div>
                                )}
                                {/* Zone condition — only relevant for zone-based rules when no specific use case selected */}
                                {!selectedUseCaseDef && (detectionRule === 'enter_area' || detectionRule === 'exit_area' || detectionRule === 'loitering') && (
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Điều kiện kích hoạt vùng</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {([
                                        { value: 'inside' as const, label: 'Tâm trong vùng', desc: 'Tâm bounding box nằm bên trong polygon' },
                                        { value: 'intersect' as const, label: 'Chạm vào vùng', desc: 'Bất kỳ phần nào của bbox chạm viền polygon' },
                                      ]).map(opt => (
                                        <button key={opt.value} type="button" onClick={() => setZoneCondition(opt.value)}
                                          className={`text-left p-2.5 rounded-xl border-2 cursor-pointer transition-all ${zoneCondition === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                          <p className={`text-[11px] font-bold ${zoneCondition === opt.value ? 'text-emerald-700' : 'text-slate-700'}`}>{opt.label}</p>
                                          <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{opt.desc}</p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {taskType === 'counting' && (
                              <>
                                {!(['bld_elevator_queue', 'edu_attendance', 'bld_meeting_room'].includes(selectedUseCaseDef?.id || '')) && (
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hướng đếm</label>
                                  <select value={countingDirection} onChange={e => setCountingDirection(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                    <option value="in">Chỉ đếm chiều vào</option>
                                    <option value="out">Chỉ đếm chiều ra</option>
                                    <option value="both">Đếm cả 2 chiều</option>
                                    </select>
                                  </div>
                                )}
                                {/* Product image — only show when NOT using a domain use case that already uploaded images */}
                                {!(['prd_counting', 'wh_counting', 'ret_counting', 'ret_queue', 'tra_smartpark', 'tra_count', 'bld_elevator_queue', 'bld_inout', 'hc_queue', 'edu_attendance', 'ap_queue', 'bld_meeting_room'].includes(selectedUseCaseDef?.id || '')) && (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ảnh sản phẩm cần đếm <span className="font-normal normal-case text-slate-400">(Tuỳ chọn)</span></label>
                                  <p className="text-[9px] text-slate-400 mb-2">Upload ảnh mẫu để AI chỉ đếm riêng loại sản phẩm này. Để trống = đếm tất cả đối tượng đã chọn.</p>
                                  {countingProductImage ? (
                                    <div className="relative flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2">
                                      <img src={countingProductImage} alt="Sản phẩm cần đếm" className="w-14 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700">Ảnh mẫu đã chọn</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">AI sẽ chỉ đếm sản phẩm có ngoại hình tương tự ảnh này</p>
                                      </div>
                                      <button type="button" onClick={() => setCountingProductImage(null)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer flex-shrink-0">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="block border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 hover:border-emerald-300 transition-colors cursor-pointer">
                                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setCountingProductImage(ev.target?.result as string);
                                        reader.readAsDataURL(file);
                                        e.target.value = '';
                                      }} />
                                      <Package size={18} className="mx-auto text-slate-300 mb-1.5" />
                                      <p className="text-xs text-slate-500">Kéo thả hoặc click để upload ảnh sản phẩm</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG · Tối đa 5MB</p>
                                    </label>
                                  )}
                                </div>
                                )}
                                {/* When product counting UC was selected, remind user their images are already set above */}
                                {(selectedUseCaseDef?.id === 'prd_counting' || selectedUseCaseDef?.id === 'wh_counting') && useCaseImages.length > 0 && (
                                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                    <Package size={13} className="text-emerald-600 flex-shrink-0" />
                                    <p className="text-[10px] text-emerald-700">{useCaseImages.length} ảnh mẫu sản phẩm đã được upload ở bước trên</p>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Xác nhận sau (giây)</label>
                                <input type="number" value={alertDuration} onChange={e => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                                <p className="text-[9px] text-slate-400 mt-1">Phải diễn ra liên tục bao lâu</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngưỡng số lượng</label>
                                <input type="number" value={alertCount} onChange={e => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                                <p className="text-[9px] text-slate-400 mt-1">Phát hiện ≥ N đối tượng thì báo</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                                <input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                                <p className="text-[9px] text-slate-400 mt-1">Chờ trước khi báo tiếp (giây)</p>
                              </div>
                            </div>
                          </>
                        )}

                        {taskType === 'ppe' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Cảnh báo khi KHÔNG mang</label>
                              <div className="grid grid-cols-2 gap-2">
                                {[['hardhat', 'Mũ bảo hộ'], ['vest', 'Áo dạ quang'], ['glove', 'Găng tay'], ['mask', 'Khẩu trang']].map(([k, label]) => (
                                  <label key={k} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" checked={ppeItems[k as keyof typeof ppeItems]} onChange={() => setPpeItems(p => ({ ...p, [k]: !p[k as keyof typeof ppeItems] }))} className="w-4 h-4 rounded text-emerald-600" />
                                    <span className="text-sm text-slate-700">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                              <input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                              <p className="text-[9px] text-slate-400 mt-1">Chờ trước khi báo tiếp (giây)</p>
                            </div>
                          </>
                        )}

                        {taskType === 'fire' && (
                          <>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600">Mặc định: Khói (Smoke) & Lửa (Fire)</div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mức độ nhạy cảm</label>
                              <select value={fireSensitivity} onChange={e => setFireSensitivity(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <option value="high">Cao – Báo khi có vệt khói/lửa nhỏ</option>
                                <option value="medium">Trung bình – Báo khi đám cháy rõ</option>
                                <option value="low">Thấp – Tránh báo giả do hơi nước</option>
                              </select>
                            </div>
                          </>
                        )}

                        {taskType === 'traffic' && (
                          <>
                            {!(['tra_congestion', 'tra_smartpark', 'tra_count'].includes(selectedUseCaseDef?.id || '')) && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đối tượng giao thông</label>
                                <select value={detectionTarget} onChange={e => setDetectionTarget(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                  <option value="vehicle">Mọi loại xe</option>
                                  <option value="car">Ô tô</option>
                                  <option value="motorcycle">Xe máy</option>
                                  <option value="truck">Xe tải / Xe buýt</option>
                                  <option value="license_plate">Biển số xe (ALPR)</option>
                                </select>
                              </div>
                            )}
                            {!selectedUseCaseDef ? (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Luật giao thông</label>
                                <select value={detectionRule} onChange={e => setDetectionRule(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                  <option value="alpr">Nhận diện & Đọc biển số</option>
                                  <option value="wrong_way">Đi ngược chiều</option>
                                  <option value="illegal_parking">Dừng đỗ sai quy định</option>
                                </select>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Luật giao thông</label>
                                <input type="text" value={selectedUseCaseDef.name} disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
                                <p className="text-[9px] text-slate-400 mt-1">Đã cấu hình riêng cho bài toán này.</p>
                              </div>
                            )}
                          </>
                        )}

                        {taskType === 'behavior' && (
                          <>
                            {!selectedUseCaseDef ? (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Hành vi cần phát hiện</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[['fall', 'Té ngã / Đột quỵ'], ['violence', 'Đánh nhau / Ẩu đả'], ['crowd', 'Tụ tập đông người'], ['smoking', 'Hút thuốc'], ['phone', 'Dùng điện thoại'], ['weapon', 'Người mang vũ khí']].map(([k, label]) => (
                                    <label key={k} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                      <input type="checkbox" checked={behaviorItems[k as keyof typeof behaviorItems]} onChange={() => setBehaviorItems(p => ({ ...p, [k]: !p[k as keyof typeof behaviorItems] }))} className="w-4 h-4 rounded text-emerald-600" />
                                      <span className="text-sm text-slate-700">{label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hành vi cần phát hiện</label>
                                <input type="text" value={selectedUseCaseDef.name} disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
                                <p className="text-[9px] text-slate-400 mt-1">Đã cấu hình riêng cho bài toán này.</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Xác nhận sau (giây)</label>
                                <input type="number" value={alertDuration} onChange={e => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                                <p className="text-[9px] text-slate-400 mt-1">Hành vi phải diễn ra liên tục bao lâu</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                                <input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                                <p className="text-[9px] text-slate-400 mt-1">Chờ trước khi báo tiếp (giây)</p>
                              </div>
                            </div>
                          </>
                        )}

                        {taskType === 'retail_analytics' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chế độ phân tích</label>
                              <select value={retailMode} onChange={e => setRetailMode(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <option value="heatmap">Biểu đồ nhiệt (Heatmap)</option>
                                {selectedUseCaseDef?.id !== 'bld_public_density' && (
                                  <option value="demographics">Nhân khẩu học (tuổi, giới tính)</option>
                                )}
                                <option value="flow">Luồng di chuyển khách hàng</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nghỉ giữa cảnh báo</label>
                              <input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                              <p className="text-[9px] text-slate-400 mt-1">Chờ trước khi báo tiếp (giây)</p>
                            </div>
                          </>
                        )}
                      </>
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
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Thuật toán bám đuổi <span className="font-normal text-slate-400 normal-case">(Tracker)</span></label>
                              <select value={tracker} onChange={e => setTracker(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <option value="bytetrack">ByteTrack — chính xác, nhanh</option>
                                <option value="deepsort">DeepSORT — mượt, tốn hơn</option>
                                <option value="none">Không bám đuổi — nhanh nhất</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Bỏ qua frame <span className="font-normal text-slate-400 normal-case">(Frame skip)</span></label>
                              <select value={frameSkip} onChange={e => setFrameSkip(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <option value={0}>0 — xử lý mọi frame</option>
                                <option value={1}>1 — bỏ 1 frame xen kẽ</option>
                                <option value={2}>2 — xử lý 1/3 frame</option>
                                <option value={4}>4 — xử lý 1/5 frame (tiết kiệm)</option>
                              </select>
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
              <h3 className="text-base font-bold text-slate-800">Thiết lập nhận thông báo</h3>
              <p className="text-xs text-slate-500 mt-1">Khi sự kiện kích hoạt, VisionOS sẽ gửi cảnh báo đến các kênh được chọn.</p>
            </div>
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

          // Label helpers
          const targetLabel = detectionTarget === 'custom'
            ? (customTarget || 'Tuỳ chỉnh')
            : ({ person: 'Người', vehicle: 'Phương tiện', motorcycle: 'Xe máy', truck: 'Xe tải', bicycle: 'Xe đạp' } as Record<string, string>)[detectionTarget] || detectionTarget;
          const ruleLabel = ({ enter_area: 'Xâm nhập vùng', exit_area: 'Ra khỏi vùng', cross_line: 'Vượt vạch', loitering: 'Dừng đỗ lâu', appear: 'Xuất hiện đối tượng', object_counting: 'Đếm đối tượng' } as Record<string, string>)[detectionRule] || detectionRule;
          const presetLabel = perfPreset === 'economy' ? '🌿 Tiết kiệm' : perfPreset === 'precise' ? '🎯 Chính xác' : '⚡ Cân bằng';
          const modeLabel = monitoringMode === 'smart' ? '✦ Luồng thông minh' : monitoringMode === 'defect_detection' ? '🔬 Kiểm tra lỗi' : '⚙ Tiêu chuẩn';

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

            if (monitoringMode === 'smart') {
              const contextParts: string[] = [];
              if (aiContext.environment) contextParts.push(`môi trường: ${aiContext.environment}`);
              if (aiContext.normalBehavior) contextParts.push(`bỏ qua: ${aiContext.normalBehavior}`);
              if (aiContext.specialNotes) contextParts.push(`lưu ý: ${aiContext.specialNotes}`);
              const baseDesc = userDescription.trim() || 'giám sát theo yêu cầu người dùng';
              return `AI sẽ ${baseDesc} ${zoneDesc}` +
                (contextParts.length > 0 ? ` (${contextParts.join('; ')})` : '') +
                `. Hệ thống chạy ${scheduleDesc}, xác nhận sự kiện sau ${alertDuration}s và nghỉ ${cooldown}s giữa các cảnh báo liên tiếp.`;
            }

            if (monitoringMode === 'standard') {
              const tLabel = detectionTarget === 'custom' ? (customTarget || 'đối tượng tuỳ chỉnh') :
                ({ person: 'người', vehicle: 'phương tiện', motorcycle: 'xe máy', truck: 'xe tải', bicycle: 'xe đạp', forklift: 'xe nâng', package: 'hàng hoá/thùng hộp', pet: 'thú cưng', unknown_object: 'vật thể không xác định' } as Record<string,string>)[detectionTarget] || detectionTarget;
              const rLabel = ({ enter_area: 'xâm nhập vùng cấm', exit_area: 'rời khỏi khu vực', cross_line: 'vượt ranh giới ảo', appear: 'xuất hiện đột ngột', disappear: 'mất/bị lấy đi', loitering: 'dừng đỗ/lảng vảng lâu', crowd_gathering: 'tụ tập đông người', object_counting: 'vượt ngưỡng số lượng' } as Record<string,string>)[detectionRule] || detectionRule;
              const condDesc = (detectionRule === 'enter_area' || detectionRule === 'exit_area' || detectionRule === 'loitering')
                ? (zoneCondition === 'inside' ? ' (tâm đối tượng nằm trong vùng)' : ' (bất kỳ phần nào chạm vào vùng)')
                : '';
              const productDesc = countingProductImage ? ' — chỉ đếm sản phẩm khớp ảnh mẫu đã upload' : '';
              return `Hệ thống theo dõi ${tLabel} và phát cảnh báo theo luật "${rLabel}"${condDesc} ${zoneDesc}${productDesc}. ` +
                `Sự kiện cần diễn ra liên tục ${alertDuration}s trước khi cảnh báo. Luồng chạy ${scheduleDesc}.`;
            }

            // defect_detection
            const methods = [enableSSIM && 'kiểm tra bề mặt (MS-SSIM + FSIM)', enableCNN && 'đặc trưng ngữ nghĩa (DINOv2)', enableOCR && 'đọc nhãn mác (PaddleOCR)'].filter(Boolean).join(', ');
            return `AI so sánh sản phẩm thực tế với ${goldenSamples.length > 0 ? `${goldenSamples.length} ảnh mẫu chuẩn` : 'ảnh mẫu (chưa upload)'} sử dụng ${methods || 'kiểm tra bề mặt mặc định'}. ` +
              `Mỗi sản phẩm được phân tích tại ${inferenceFps} FPS và nhận phán quyết OK/NG theo ngưỡng đã cấu hình.`;
          };

          // Always resolve a meaningful model name for display
          const displayModelName =
            monitoringMode === 'defect_detection'
              ? `CNN Defect Inspector${enableOCR ? ' + OCR' : ''}${enableCNN ? ' + CNN' : ''}`
              : monitoringMode === 'standard'
              ? (STANDARD_MODEL_NAMES[taskType] || 'YOLO-NAS-S')
              : (routedModelName && routedModelName !== 'Chưa xác định' ? routedModelName : 'LocateAnything-3B');

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
                      {monitoringMode === 'smart' && userDescription && (
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
                      {/* Mode */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Chế độ</span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {monitoringMode === 'smart' ? 'Luồng thông minh' : monitoringMode === 'defect_detection' ? 'Kiểm tra lỗi' : 'Tiêu chuẩn'}
                        </span>
                      </div>

                      {/* Performance preset */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Hiệu năng</span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {perfPreset === 'economy' ? 'Tiết kiệm' : perfPreset === 'precise' ? 'Chính xác' : 'Cân bằng'}
                          <span className="text-slate-400 font-normal"> · {inferenceFps} FPS</span>
                        </span>
                      </div>

                      {/* Standard: target + rule */}
                      {monitoringMode === 'standard' && (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Đối tượng</span>
                            <span className="text-[11px] font-semibold text-slate-800">{targetLabel}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Quy tắc</span>
                            <span className="text-[11px] font-semibold text-slate-800">{ruleLabel}</span>
                          </div>
                        </>
                      )}

                      {/* Smart: search query */}
                      {monitoringMode === 'smart' && searchQuery && (
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0 pt-px">Từ khoá AI</span>
                          <span className="text-[11px] font-semibold text-slate-800 line-clamp-2">{searchQuery}</span>
                        </div>
                      )}

                      {/* Defect: samples + features */}
                      {monitoringMode === 'defect_detection' && (
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
                          {monitoringMode !== 'defect_detection' && maxLimit > 0 && (
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
                disabled={currentStep === 'camera' && selectedCameraIds.length === 0}
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
