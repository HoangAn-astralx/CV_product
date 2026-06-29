import { Camera, Pipeline, AlertEvent, LogEntry } from './types';

export const INITIAL_CAMERAS: Camera[] = [
  {
    id: 'cam-retail',
    name: 'Camera Cửa hàng Bán lẻ',
    location: 'Khu vực Lối ra vào & Quầy kệ',
    type: 'retail',
    status: 'online',
    fps: 30,
    resolution: '1920x1080',
    latency: 120,
    site: 'Hà Nội',
  },
  {
    id: 'cam-warehouse',
    name: 'Camera Kho hàng Trung tâm',
    location: 'Khu vực bốc xếp & Lưu trữ',
    type: 'warehouse',
    status: 'online',
    fps: 25,
    resolution: '1920x1080',
    latency: 180,
    site: 'Bình Dương',
  },
  {
    id: 'cam-parking',
    name: 'Camera Bãi đỗ xe thông minh',
    location: 'Cổng vào & Khu bãi đỗ',
    type: 'parking',
    status: 'online',
    fps: 30,
    resolution: '2560x1440',
    latency: 150,
    site: 'TP.HCM',
  },
  {
    id: 'cam-conveyor',
    name: 'Camera Băng chuyền Nhà máy',
    location: 'Dây chuyền Đóng gói Sản phẩm',
    type: 'conveyor',
    status: 'online',
    fps: 60,
    resolution: '1280x720',
    latency: 45,
    site: 'Bình Dương',
  }
];

export const MODEL_OPTIONS = [
  {
    id: 'model-yolo',
    name: 'Đếm Số Lượng Tốc Độ Cao',
    description: 'AI tự động nhận diện và đếm các đồ vật quen thuộc (người, xe, hộp, chai...) ngay lập tức. Tối ưu cho tốc độ và ổn định.',
    classes: ['Người', 'Xe máy', 'Ô tô', 'Hộp giấy', 'Chai nước'],
    isCustom: false,
  },
  {
    id: 'model-locate',
    name: 'Nhận Diện Tùy Chỉnh Nâng Cao',
    description: 'Bạn có thể đếm bất kỳ đồ vật nào bằng cách tự nhập mô tả bằng tiếng Việt (ví dụ: "hộp carton màu vàng", "xe tải màu trắng"). Phù hợp với nhu cầu đặc thù.',
    classes: ['Mọi thứ mô tả bằng văn bản'],
    isCustom: true,
  }
];

export const AI_USECASES = [
  // NHẬN DIỆN ĐỐI TƯỢNG
  {
    id: 'uc-ppe',
    category: 'Nhận diện đối tượng',
    name: 'Kiểm tra đồ bảo hộ (PPE)',
    description: 'Phát hiện công nhân không đội mũ bảo hộ, không mặc áo phản quang.',
    icon: '🦺',
    tags: ['Zone Alert', 'LocateAnything'],
    modelId: 'model-locate',
    searchQuery: 'người không đội mũ bảo hộ, người không mặc áo phản quang',
    countingType: 'zone',
  },

  {
    id: 'uc-defect',
    category: 'Nhận diện đối tượng',
    name: 'Phát hiện vật thể lỗi',
    description: 'Nhận diện các vết xước, móp méo, hoặc sản phẩm không đạt chuẩn trên dây chuyền.',
    icon: '🔍',
    tags: ['Anomaly', 'LocateAnything'],
    modelId: 'model-locate',
    searchQuery: 'vết xước, vết nứt, móp méo, sản phẩm lỗi',
    countingType: 'zone',
  },

  // ĐẾM NGƯỜI
  {
    id: 'uc-people-count',
    category: 'Đếm người',
    name: 'Đếm người vào/ra',
    description: 'Đếm số lượt người đi qua cổng, cửa hàng theo hai chiều (Vào/Ra).',
    icon: '👥',
    tags: ['Line Count', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'line',
  },
  {
    id: 'uc-queue',
    category: 'Đếm người',
    name: 'Phân tích hàng chờ',
    description: 'Đếm lượng người đang xếp hàng chờ và cảnh báo nếu hàng quá dài.',
    icon: '🧍‍♂️',
    tags: ['Zone Count', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'zone',
  },
  {
    id: 'uc-dwell',
    category: 'Đếm người',
    name: 'Tính thời gian phục vụ',
    description: 'Đo lường thời gian khách ở lại quầy dịch vụ và cảnh báo nếu phục vụ quá lâu.',
    icon: '⏱️',
    tags: ['Dwell Time', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'zone',
  },

  // ĐẾM ĐỒ VẬT
  {
    id: 'uc-vehicle',
    category: 'Đếm đồ vật',
    name: 'Đếm xe ra vào',
    description: 'Giám sát lưu lượng xe ô tô, xe máy qua trạm kiểm soát hoặc bãi đỗ.',
    icon: '🚗',
    tags: ['Line Count', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'line',
  },
  {
    id: 'uc-package',
    category: 'Đếm đồ vật',
    name: 'Đếm hàng hoá trên chuyền',
    description: 'Đếm số lượng thùng carton, kiện hàng di chuyển trên băng chuyền.',
    icon: '📦',
    tags: ['Line Count', 'LocateAnything'],
    modelId: 'model-locate',
    searchQuery: 'hộp carton, kiện hàng',
    countingType: 'line',
  },
  {
    id: 'uc-inventory',
    category: 'Đếm đồ vật',
    name: 'Quản lý tồn kho kệ',
    description: 'Kiểm kê tự động số lượng hàng hoá đang có mặt trên các kệ kho.',
    icon: '🏢',
    tags: ['Zone Count', 'LocateAnything'],
    modelId: 'model-locate',
    searchQuery: 'hàng hoá trên kệ',
    countingType: 'zone',
  },

  // CẢNH BÁO
  {
    id: 'uc-intrusion',
    category: 'Gửi cảnh báo theo rule',
    name: 'Phát hiện xâm nhập',
    description: 'Báo động ngay lập tức khi phát hiện có người lạ đi vào khu vực hạn chế.',
    icon: '🚨',
    tags: ['Zone Alert', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'zone',
  },
  {
    id: 'uc-overcrowd',
    category: 'Gửi cảnh báo theo rule',
    name: 'Cảnh báo quá tải',
    description: 'Gửi thông báo khi lượng người trong một khu vực vượt quá giới hạn an toàn.',
    icon: '⚠️',
    tags: ['Zone Alert', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'zone',
  },
  {
    id: 'uc-parking-violation',
    category: 'Gửi cảnh báo theo rule',
    name: 'Dừng đỗ sai quy định',
    description: 'Phát hiện phương tiện dừng/đỗ quá thời gian cho phép tại khu vực cấm.',
    icon: '🛑',
    tags: ['Dwell Time', 'YOLO'],
    modelId: 'model-yolo',
    countingType: 'zone',
  }
];

export const PIPELINE_TEMPLATES = [
  {
    id: 'tpl-customer',
    name: 'Đếm khách vào ra',
    description: 'Tôi muốn đếm số lượng khách hàng đi vào và đi ra khỏi cửa hàng',
    cameraId: 'cam-retail',
    modelId: 'model-yolo',
    detectorName: 'YOLO-NAS-S',
    countingType: 'line',
    ruleCondition: 'count_gt_max',
  },
  {
    id: 'tpl-parking',
    name: 'Đếm xe bãi đỗ',
    description: 'Tôi cần đếm số lượng ô tô và xe máy đi qua cổng bãi đỗ',
    cameraId: 'cam-parking',
    modelId: 'model-yolo',
    detectorName: 'YOLO-NAS-S',
    countingType: 'line',
    ruleCondition: 'count_gt_max',
  },
  {
    id: 'tpl-intrusion',
    name: 'Cảnh báo xâm nhập',
    description: 'Cảnh báo khi có người lạ đi vào khu vực bốc xếp hàng hóa',
    cameraId: 'cam-warehouse',
    modelId: 'model-yolo',
    detectorName: 'YOLO-NAS-S',
    countingType: 'zone',
    ruleCondition: 'intrusion',
  },
  {
    id: 'tpl-inventory',
    name: 'Kiểm kê kệ hàng',
    description: 'Đếm số lượng hộp carton màu vàng đang có trên kệ',
    cameraId: 'cam-warehouse',
    modelId: 'model-locate',
    detectorName: 'LocateAnything-3B',
    searchQuery: 'hộp carton màu vàng',
    countingType: 'zone',
    ruleCondition: 'count_lt_min',
  },
  {
    id: 'tpl-ppe',
    name: 'Giám sát an toàn vùng nguy hiểm',
    description: 'Phát hiện công nhân không đội mũ bảo hộ trong vùng máy móc',
    cameraId: 'cam-warehouse',
    modelId: 'model-yolo-locate',
    detectorName: 'YOLO + Locate Crop',
    searchQuery: 'người không đội mũ bảo hộ',
    countingType: 'zone',
    ruleCondition: 'safety_violation',
  },
  {
    id: 'tpl-anomaly',
    name: 'Phát hiện hành vi bất thường',
    description: 'Phát hiện hàng hóa bị móp méo trên băng chuyền',
    cameraId: 'cam-conveyor',
    modelId: 'model-locate',
    detectorName: 'LocateAnything-3B',
    searchQuery: 'hàng hóa móp méo, sản phẩm lỗi',
    countingType: 'zone',
    ruleCondition: 'defect_detected',
  }
];

export const INITIAL_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-rt-1',
    name: 'Đếm khách ra vào Cửa hàng',
    cameraId: 'cam-retail',
    modelId: 'model-yolo',
    detectorName: 'YOLO-NAS-S',
    countingZones: [
      {
        id: 'zone-retail-line',
        name: 'Vạch Cửa chính',
        type: 'line',
        points: [],
        lineStart: { x: 20, y: 55 },
        lineEnd: { x: 80, y: 55 },
        count: 0,
        inCount: 142,
        outCount: 128,
      }
    ],
    alertChannels: { zalo: true, email: false, telegram: false, webhook: true },
    isActive: true,
    createdAt: '2026-06-23T08:30:00Z',
  },
  {
    id: 'pipe-wh-1',
    name: 'Giám sát An toàn Lao động (PPE & Xe nâng)',
    cameraId: 'cam-warehouse',
    modelId: 'model-yolo',
    detectorName: 'YOLO-NAS-S',
    countingZones: [
      {
        id: 'zone-warehouse-danger',
        name: 'Khu vực cấm xe nâng / Zone B',
        type: 'zone',
        points: [
          { x: 15, y: 40 },
          { x: 85, y: 40 },
          { x: 90, y: 85 },
          { x: 10, y: 85 }
        ],
        count: 0,
        maxLimit: 2,
      }
    ],
    alertChannels: { zalo: true, email: true, telegram: true, webhook: false },
    isActive: true,
    createdAt: '2026-06-23T09:15:00Z',
  },
  {
    id: 'pipe-wh-2',
    name: 'Kiểm kê Hộp carton vàng',
    cameraId: 'cam-warehouse',
    modelId: 'model-locate',
    detectorName: 'LocateAnything-3B',
    searchQuery: 'hộp carton màu vàng',
    countingZones: [
      {
        id: 'zone-warehouse-shelf',
        name: 'Khu kệ hàng phụ A',
        type: 'zone',
        points: [
          { x: 30, y: 20 },
          { x: 70, y: 20 },
          { x: 70, y: 50 },
          { x: 30, y: 50 }
        ],
        count: 5,
      }
    ],
    alertChannels: { zalo: false, email: false, telegram: false, webhook: false },
    isActive: false,
    createdAt: '2026-06-23T14:22:00Z',
  }
];

export const INITIAL_ALERTS: AlertEvent[] = [
  {
    id: 'alert-1',
    timestamp: '2026-06-23T23:15:04-07:00',
    cameraName: 'Camera Kho hàng Trung tâm',
    pipelineName: 'Giám sát An toàn Lao động (PPE & Xe nâng)',
    type: 'intrusion',
    message: 'Phát hiện có xe nâng đi vào [Khu vực cấm xe nâng / Zone B]!',
    status: 'new',
    score: 98,
  },
  {
    id: 'alert-2',
    timestamp: '2026-06-23T21:40:12-07:00',
    cameraName: 'Camera Kho hàng Trung tâm',
    pipelineName: 'Giám sát An toàn Lao động (PPE & Xe nâng)',
    type: 'overlimit',
    message: 'Cảnh báo: Nhân viên không đội mũ bảo hộ tại Zone B.',
    status: 'read',
    score: 94,
  },
  {
    id: 'alert-3',
    timestamp: '2026-06-23T15:30:22-07:00',
    cameraName: 'Camera Cửa hàng Bán lẻ',
    pipelineName: 'Đếm khách ra vào Cửa hàng',
    type: 'unusual_behavior',
    message: 'Phát hiện khách hàng đứng quá lâu ở quầy kệ mỹ phẩm (>5 phút). Cần hỗ trợ tư vấn.',
    status: 'closed',
    score: 87,
  }
];

export const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: '23:45:10',
    cameraId: 'cam-retail',
    message: 'Camera Cửa hàng Bán lẻ trực tiếp ổn định - FPS: 30',
    type: 'success',
  },
  {
    id: 'log-2',
    timestamp: '23:44:50',
    cameraId: 'cam-warehouse',
    message: 'Pipeline [Giám sát An toàn Lao động] đang quét hoạt động...',
    type: 'info',
  },
  {
    id: 'log-3',
    timestamp: '23:15:04',
    cameraId: 'cam-warehouse',
    message: '⚠️ Kích hoạt cảnh báo: Phát hiện xe nâng tại [Khu vực cấm xe nâng]',
    type: 'warning',
  },
  {
    id: 'log-4',
    timestamp: '22:10:00',
    cameraId: 'cam-parking',
    message: 'Đã sao lưu tệp video 1 tiếng trước lên hệ thống lưu trữ',
    type: 'info',
  }
];

// Analytical reports mock data
export const VISITOR_CHART_DATA = [
  { hour: '08:00', 'Vào': 15, 'Ra': 8, 'Trong vùng': 7 },
  { hour: '09:00', 'Vào': 32, 'Ra': 20, 'Trong vùng': 19 },
  { hour: '10:00', 'Vào': 45, 'Ra': 35, 'Trong vùng': 29 },
  { hour: '11:00', 'Vào': 58, 'Ra': 50, 'Trong vùng': 37 },
  { hour: '12:00', 'Vào': 40, 'Ra': 42, 'Trong vùng': 35 },
  { hour: '13:00', 'Vào': 35, 'Ra': 37, 'Trong vùng': 33 },
  { hour: '14:00', 'Vào': 48, 'Ra': 40, 'Trong vùng': 41 },
  { hour: '15:00', 'Vào': 65, 'Ra': 55, 'Trong vùng': 51 },
  { hour: '16:00', 'Vào': 72, 'Ra': 60, 'Trong vùng': 63 },
  { hour: '17:00', 'Vào': 88, 'Ra': 70, 'Trong vùng': 81 },
  { hour: '18:00', 'Vào': 95, 'Ra': 85, 'Trong vùng': 91 },
  { hour: '19:00', 'Vào': 60, 'Ra': 78, 'Trong vùng': 73 },
  { hour: '20:00', 'Vào': 30, 'Ra': 50, 'Trong vùng': 53 },
  { hour: '21:00', 'Vào': 12, 'Ra': 40, 'Trong vùng': 25 },
];

export const WAREHOUSE_CHART_DATA = [
  { day: 'Thứ 2', 'Hộp vàng': 142, 'Xe nâng': 4, 'Nhân viên': 8 },
  { day: 'Thứ 3', 'Hộp vàng': 156, 'Xe nâng': 5, 'Nhân viên': 9 },
  { day: 'Thứ 4', 'Hộp vàng': 135, 'Xe nâng': 4, 'Nhân viên': 7 },
  { day: 'Thứ 5', 'Hộp vàng': 160, 'Xe nâng': 5, 'Nhân viên': 9 },
  { day: 'Thứ 6', 'Hộp vàng': 175, 'Xe nâng': 6, 'Nhân viên': 10 },
  { day: 'Thứ 7', 'Hộp vàng': 120, 'Xe nâng': 3, 'Nhân viên': 5 },
  { day: 'Chủ nhật', 'Hộp vàng': 110, 'Xe nâng': 2, 'Nhân viên': 3 },
];

export const VISITOR_RATIO = [
  { name: 'Lượt Vào', value: 732, color: '#10b981' },
  { name: 'Lượt Ra', value: 698, color: '#3b82f6' },
];

export const WAREHOUSE_PROPORTION = [
  { name: 'Hộp carton', value: 998, color: '#f59e0b' },
  { name: 'Xe nâng', value: 29, color: '#3b82f6' },
  { name: 'Nhân viên', value: 51, color: '#10b981' },
];

export const ALERT_CHART_DATA = [
  { time: 'Thứ 2', 'Danger': 2, 'Warning': 5, 'Info': 12 },
  { time: 'Thứ 3', 'Danger': 0, 'Warning': 3, 'Info': 15 },
  { time: 'Thứ 4', 'Danger': 1, 'Warning': 8, 'Info': 9 },
  { time: 'Thứ 5', 'Danger': 3, 'Warning': 2, 'Info': 20 },
  { time: 'Thứ 6', 'Danger': 0, 'Warning': 4, 'Info': 18 },
  { time: 'Thứ 7', 'Danger': 1, 'Warning': 1, 'Info': 8 },
  { time: 'Chủ nhật', 'Danger': 0, 'Warning': 0, 'Info': 5 },
];

export const OBJECT_CHART_DATA = [
  { time: '08:00', 'Xe máy': 45, 'Ô tô': 12, 'Xe tải': 3 },
  { time: '10:00', 'Xe máy': 80, 'Ô tô': 35, 'Xe tải': 8 },
  { time: '12:00', 'Xe máy': 120, 'Ô tô': 50, 'Xe tải': 5 },
  { time: '14:00', 'Xe máy': 90, 'Ô tô': 42, 'Xe tải': 10 },
  { time: '16:00', 'Xe máy': 150, 'Ô tô': 65, 'Xe tải': 6 },
  { time: '18:00', 'Xe máy': 180, 'Ô tô': 80, 'Xe tải': 2 },
  { time: '20:00', 'Xe máy': 60, 'Ô tô': 20, 'Xe tải': 1 },
];

export const OBJECT_PROPORTION_DATA = [
  { name: 'Xe máy', value: 725, color: '#10b981' },
  { name: 'Ô tô', value: 304, color: '#3b82f6' },
  { name: 'Xe tải', value: 35, color: '#f59e0b' },
  { name: 'Khác', value: 12, color: '#64748b' },
];

export const SMART_SEARCH_PRESETS = [
  { text: 'Người đội mũ bảo hộ màu đỏ', camera: 'Camera Kho hàng Trung tâm', time: '10 phút trước' },
  { text: 'Xe tải màu trắng đi ra', camera: 'Camera Bãi đỗ xe thông minh', time: '1 giờ trước' },
  { text: 'Khách hàng mặc áo thun xanh', camera: 'Camera Cửa hàng Bán lẻ', time: '2 giờ trước' },
  { text: 'Hộp carton bị móp góc', camera: 'Camera Băng chuyền Nhà máy', time: '30 phút trước' },
];

export const RETAIL_HEATMAP = [
  [10, 15, 20, 20, 10, 5],
  [15, 40, 80, 75, 20, 10],
  [20, 85, 100, 90, 30, 15],
  [15, 60, 95, 80, 25, 10],
  [10, 30, 50, 40, 15, 5],
  [5,  10, 15, 10,  5, 0]
];

export const WAREHOUSE_HEATMAP = [
  [5, 5, 10, 20, 25, 30],
  [5, 10, 20, 60, 80, 85],
  [10, 15, 40, 90, 100, 95],
  [15, 20, 50, 85, 90, 70],
  [10, 15, 30, 60, 50, 40],
  [5, 10, 15, 20, 15, 10]
];

export const RETAIL_ALERTS = [
  { id: 1, time: '17:45', type: 'warning', message: 'Hàng chờ thanh toán vượt quá 5 người' },
  { id: 2, time: '16:30', type: 'info', message: 'Khu vực quầy mỹ phẩm tập trung đông khách' },
  { id: 3, time: '14:20', type: 'danger', message: 'Phát hiện đối tượng trong danh sách theo dõi' },
  { id: 4, time: '11:15', type: 'info', message: 'Lưu lượng khách vào cửa chính tăng đột biến' },
];

export const WAREHOUSE_ALERTS = [
  { id: 1, time: '14:30', type: 'danger', message: 'Xe nâng di chuyển vào khu vực cấm' },
  { id: 2, time: '13:15', type: 'warning', message: 'Nhân viên không đội mũ bảo hộ tại Zone B' },
  { id: 3, time: '10:45', type: 'info', message: 'Hoàn thành bốc xếp lô hàng mã #WH-884' },
  { id: 4, time: '09:20', type: 'warning', message: 'Tốc độ băng chuyền đóng gói giảm 20%' },
];

import { AlertRule } from './types';

export const INITIAL_RULES: AlertRule[] = [
  {
    id: 'rule-wh-1',
    name: 'Cảnh báo xâm nhập vùng cấm',
    cameraId: 'cam-warehouse',
    pipelineId: 'pipe-wh-1',
    isActive: true,
    targetObject: 'Nhân viên',
    condition: 'Đi vào Khu vực xe nâng',
    action: 'Hiển thị cảnh báo màn hình & Còi hú',
    severity: 'critical',
    createdAt: '2023-10-25T08:00:00Z',
  },
  {
    id: 'rule-cv-1',
    name: 'Báo động sản phẩm móp méo',
    cameraId: 'cam-conveyor',
    pipelineId: 'pipe-cv-1',
    isActive: true,
    targetObject: 'Hộp carton',
    condition: 'Phát hiện vết móp méo / rách',
    action: 'Dừng băng chuyền & Cảnh báo',
    severity: 'error',
    createdAt: '2023-10-26T09:15:00Z',
  },
  {
    id: 'rule-pk-1',
    name: 'Cảnh báo đỗ sai quy định',
    cameraId: 'cam-parking',
    pipelineId: 'pipe-pk-2',
    isActive: false,
    targetObject: 'Ô tô',
    condition: 'Đỗ tại khu vực VIP quá 15 phút',
    action: 'Gửi tin nhắn Telegram cho bảo vệ',
    severity: 'warning',
    createdAt: '2023-10-27T14:30:00Z',
  }
];
