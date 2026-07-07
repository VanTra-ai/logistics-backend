import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

// ─── Cấu hình nhãn dán ───────────────────────────────────────────────────────
// Kích thước chuẩn A6: 105mm × 148mm = 297.6pt × 419.5pt (1pt = 1/72 inch = 0.353mm)
const A6_WIDTH_PT = 297.6;
const A6_HEIGHT_PT = 419.5;

// Bảng màu thương hiệu VanTra
const BRAND_PRIMARY = '#1565C0';
const BRAND_WHITE = '#FFFFFF';
const GRAY_LIGHT = '#F5F5F5';
const GRAY_MEDIUM = '#9E9E9E';
const GRAY_DARK = '#424242';
const DANGER_RED = '#D32F2F';

// ─── Helper: Format tiền tệ Việt Nam ─────────────────────────────────────────
function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

// ─── Helper: Rút ngắn chuỗi dài ──────────────────────────────────────────────
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

@Injectable()
export class LabelService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  /**
   * Tạo PDF nhãn dán vận chuyển (Shipping Label) khổ A6 cho một đơn hàng.
   *
   * Bố cục nhãn dán (từ trên xuống dưới):
   *  1. Header màu xanh: Logo/Tên thương hiệu + Mã chuyến (nếu có)
   *  2. Mã vận đơn lớn (tracking number) + Mã QR
   *  3. Thông tin Người nhận (nổi bật)
   *  4. Divider
   *  5. Thông tin Người gửi (chữ nhỏ hơn)
   *  6. Footer: Thông số hàng hoá, COD, Cước phí
   *  7. Chú thích (nếu có)
   */
  async generateShippingLabel(orderId: string): Promise<Buffer> {
    // ── 1. Truy vấn DB ───────────────────────────────────────────────────────
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { pickup_hub: true, shipper: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng!');
    }

    // ── 2. Sinh mã QR buffer (PNG) từ mã vận đơn ─────────────────────────────
    // Chứa JSON mini để mobile scanner có thể parse đầy đủ thông tin
    const qrPayload = JSON.stringify({
      id: order.id,
      tn: order.tracking_number,
    });
    const qrBuffer: Buffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    // ── 3. Khởi tạo PDFDocument A6 ────────────────────────────────────────────
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [A6_WIDTH_PT, A6_HEIGHT_PT],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Nhãn vận chuyển - ${order.tracking_number}`,
          Author: 'VanTra Logistics',
          Subject: 'Shipping Label',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Padding ngang chuẩn
      const PAD = 14;
      const contentWidth = A6_WIDTH_PT - PAD * 2;

      // ────────────────────────────────────────────────────────────────────────
      // VÙNG 1: HEADER – thanh màu xanh thương hiệu
      // ────────────────────────────────────────────────────────────────────────
      const HEADER_H = 40;
      doc.rect(0, 0, A6_WIDTH_PT, HEADER_H).fill(BRAND_PRIMARY);

      // Tên thương hiệu
      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .fillColor(BRAND_WHITE)
        .text('VANTRA LOGISTICS', PAD, 11, {
          width: contentWidth - 60,
          align: 'left',
        });

      // Ngày tạo đơn (nhỏ)
      const createdDate = order.created_at
        ? new Date(order.created_at).toLocaleDateString('vi-VN')
        : '';
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#BBDEFB')
        .text(createdDate, A6_WIDTH_PT - 70, 16, { width: 60, align: 'right' });

      // ────────────────────────────────────────────────────────────────────────
      // VÙNG 2: TRACKING NUMBER + QR CODE
      // ────────────────────────────────────────────────────────────────────────
      const TN_ZONE_Y = HEADER_H + 8;
      const QR_SIZE = 72;

      // Mã vận đơn lớn, nổi bật
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(BRAND_PRIMARY)
        .text(order.tracking_number, PAD, TN_ZONE_Y, {
          width: contentWidth - QR_SIZE - 10,
          align: 'left',
        });

      // Label phụ bên dưới mã vận đơn
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY_MEDIUM)
        .text('Mã vận đơn • Quét để cập nhật trạng thái', PAD, TN_ZONE_Y + 23, {
          width: contentWidth - QR_SIZE - 10,
        });

      // Hình QR code — căn phải trong vùng tracking
      const QR_X = A6_WIDTH_PT - PAD - QR_SIZE;
      const QR_Y = TN_ZONE_Y;
      doc.image(qrBuffer, QR_X, QR_Y, { width: QR_SIZE, height: QR_SIZE });

      // ────────────────────────────────────────────────────────────────────────
      // VÙNG 3: THÔNG TIN NGƯỜI NHẬN (nổi bật nhất)
      // ────────────────────────────────────────────────────────────────────────
      const RECV_Y = TN_ZONE_Y + QR_SIZE + 8;

      // Nền xám nhạt cho vùng người nhận
      doc
        .rect(PAD - 6, RECV_Y - 4, A6_WIDTH_PT - (PAD - 6) * 2, 68)
        .fill(GRAY_LIGHT);

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY_MEDIUM)
        .text('NGƯỜI NHẬN', PAD, RECV_Y + 2);

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(GRAY_DARK)
        .text(truncate(order.receiver_name, 30), PAD, RECV_Y + 13, {
          width: contentWidth,
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(GRAY_DARK)
        .text(order.receiver_phone, PAD, RECV_Y + 30, { width: contentWidth });

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(GRAY_DARK)
        .text(truncate(order.receiver_address, 80), PAD, RECV_Y + 44, {
          width: contentWidth,
        });

      // ────────────────────────────────────────────────────────────────────────
      // DIVIDER
      // ────────────────────────────────────────────────────────────────────────
      const DIV_Y = RECV_Y + 74;
      doc
        .moveTo(PAD, DIV_Y)
        .lineTo(A6_WIDTH_PT - PAD, DIV_Y)
        .dash(3, { space: 3 })
        .strokeColor('#BDBDBD')
        .lineWidth(0.5)
        .stroke()
        .undash();

      // ────────────────────────────────────────────────────────────────────────
      // VÙNG 4: THÔNG TIN NGƯỜI GỬI
      // ────────────────────────────────────────────────────────────────────────
      const SEND_Y = DIV_Y + 6;

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY_MEDIUM)
        .text('NGƯỜI GỬI', PAD, SEND_Y);

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GRAY_DARK)
        .text(truncate(order.sender_name, 35), PAD, SEND_Y + 10, {
          width: contentWidth * 0.6,
        });

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(GRAY_DARK)
        .text(order.sender_phone, PAD, SEND_Y + 22, {
          width: contentWidth * 0.6,
        });

      doc
        .fontSize(7.5)
        .fillColor(GRAY_MEDIUM)
        .text(truncate(order.sender_address, 60), PAD, SEND_Y + 33, {
          width: contentWidth * 0.6,
        });

      // Bưu cục nhận hàng (góc phải)
      if (order.pickup_hub) {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(GRAY_MEDIUM)
          .text('BƯU CỤC', A6_WIDTH_PT / 2 + 10, SEND_Y, { align: 'left' });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(BRAND_PRIMARY)
          .text(
            truncate(order.pickup_hub.name, 25),
            A6_WIDTH_PT / 2 + 10,
            SEND_Y + 10,
          );
      }

      // ────────────────────────────────────────────────────────────────────────
      // VÙNG 5: FOOTER – Thông số hàng hoá, COD, Cước phí
      // ────────────────────────────────────────────────────────────────────────
      const FOOTER_Y = A6_HEIGHT_PT - 66;

      // Đường kẻ solid trước footer
      doc
        .moveTo(0, FOOTER_Y - 2)
        .lineTo(A6_WIDTH_PT, FOOTER_Y - 2)
        .lineWidth(0.8)
        .strokeColor('#E0E0E0')
        .stroke();

      // Background footer
      doc.rect(0, FOOTER_Y - 2, A6_WIDTH_PT, 68).fill(GRAY_LIGHT);

      // ── Cột 1: Khối lượng & kích thước ──
      const COL1_X = PAD;
      const COL2_X = A6_WIDTH_PT / 3 + 5;
      const COL3_X = (A6_WIDTH_PT * 2) / 3 + 5;

      _drawFooterCell(
        doc,
        COL1_X,
        FOOTER_Y + 4,
        'KHỐI LƯỢNG',
        `${Number(order.weight).toFixed(2)} kg`,
      );
      _drawFooterCell(
        doc,
        COL1_X,
        FOOTER_Y + 28,
        'KÍCH THƯỚC',
        order.length && order.width && order.height
          ? `${Number(order.length)}×${Number(order.width)}×${Number(order.height)} cm`
          : 'N/A',
        8,
      );

      // ── Cột 2: Cước phí ──
      _drawFooterCell(
        doc,
        COL2_X,
        FOOTER_Y + 4,
        'CƯỚC PHÍ',
        formatVND(Number(order.shipping_fee)),
      );

      // ── Cột 3: COD (nổi bật màu đỏ nếu có) ──
      const codAmount = Number(order.cod_amount);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY_MEDIUM)
        .text('TIỀN THU HỘ (COD)', COL3_X, FOOTER_Y + 4);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(codAmount > 0 ? DANGER_RED : GRAY_MEDIUM)
        .text(
          codAmount > 0 ? formatVND(codAmount) : 'Không có',
          COL3_X,
          FOOTER_Y + 14,
          {
            width: A6_WIDTH_PT - COL3_X - PAD,
          },
        );

      // ── Ghi chú đơn hàng ──
      if (order.note) {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(GRAY_MEDIUM)
          .text(`Ghi chú: ${truncate(order.note, 60)}`, PAD, FOOTER_Y + 46, {
            width: contentWidth,
          });
      }

      // ── Barcode-style border decoration ──
      doc.rect(0, A6_HEIGHT_PT - 12, A6_WIDTH_PT, 12).fill(BRAND_PRIMARY);

      doc
        .font('Helvetica')
        .fontSize(6)
        .fillColor(BRAND_WHITE)
        .text(
          'vantra-logistics.vn  •  Hotline: 1900 xxxx',
          0,
          A6_HEIGHT_PT - 10,
          {
            width: A6_WIDTH_PT,
            align: 'center',
          },
        );

      doc.end();
    });
  }
}

// ─── Helper nội bộ: Vẽ ô thông tin trong footer ──────────────────────────────
function _drawFooterCell(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  label: string,
  value: string,
  valueFontSize = 10,
) {
  doc.font('Helvetica').fontSize(7).fillColor(GRAY_MEDIUM).text(label, x, y);
  doc
    .font('Helvetica-Bold')
    .fontSize(valueFontSize)
    .fillColor(GRAY_DARK)
    .text(value, x, y + 10);
}
