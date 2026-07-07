import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as exceljs from 'exceljs';
import { Order } from './order.entity';

@Injectable()
export class OrdersExcelService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Import đơn hàng từ file Excel/CSV.
   * Yêu cầu: Sử dụng Database Transaction để rollback nếu có lỗi ở bất kỳ dòng nào.
   */
  async importOrders(fileBuffer: Buffer): Promise<Order[]> {
    const workbook = new exceljs.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'File không hợp lệ hoặc không đúng định dạng Excel (.xlsx).',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(
        'File không có dữ liệu (không có sheet nào).',
      );
    }

    const rowErrors: string[] = [];
    const ordersToCreate: Partial<Order>[] = [];

    // Header được giả định nằm ở dòng 1.

    worksheet.eachRow((row, rowNumber) => {
      // Bỏ qua dòng tiêu đề
      if (rowNumber === 1) return;

      const tracking_number = row.getCell(1).text?.trim();
      const sender_name = row.getCell(2).text?.trim();
      const sender_phone = row.getCell(3).text?.trim();
      const sender_address = row.getCell(4).text?.trim();
      const receiver_name = row.getCell(5).text?.trim();
      const receiver_phone = row.getCell(6).text?.trim();
      const receiver_address = row.getCell(7).text?.trim();
      const weightStr = row.getCell(8).text?.trim();
      const codStr = row.getCell(9).text?.trim();

      const rowErrorDetails: string[] = [];

      if (!tracking_number) rowErrorDetails.push('Thiếu Mã vận đơn');
      if (!sender_name) rowErrorDetails.push('Thiếu Người gửi');
      if (!sender_phone) rowErrorDetails.push('Thiếu SĐT gửi');
      if (!sender_address) rowErrorDetails.push('Thiếu Địa chỉ gửi');
      if (!receiver_name) rowErrorDetails.push('Thiếu Người nhận');
      if (!receiver_phone) rowErrorDetails.push('Thiếu SĐT nhận');
      if (!receiver_address) rowErrorDetails.push('Thiếu Địa chỉ nhận');

      const weight = weightStr ? parseFloat(weightStr) : 0;
      const cod_amount = codStr ? parseFloat(codStr) : 0;

      if (isNaN(weight)) rowErrorDetails.push('Khối lượng không hợp lệ');
      if (isNaN(cod_amount)) rowErrorDetails.push('COD không hợp lệ');

      if (rowErrorDetails.length > 0) {
        rowErrors.push(`Dòng ${rowNumber}: ${rowErrorDetails.join(', ')}`);
      } else {
        ordersToCreate.push({
          tracking_number,
          sender_name,
          sender_phone,
          sender_address,
          receiver_name,
          receiver_phone,
          receiver_address,
          weight,
          cod_amount,
          current_status: 'PENDING',
          cod_status: 'PENDING',
        });
      }
    });

    if (rowErrors.length > 0) {
      throw new BadRequestException({
        message:
          'Dữ liệu file không hợp lệ, thao tác bị huỷ bỏ (Rollback toàn bộ).',
        errors: rowErrors,
      });
    }

    if (ordersToCreate.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy dữ liệu đơn hàng nào để import.',
      );
    }

    // Thực hiện Bulk Insert qua Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderRepository = queryRunner.manager.getRepository(Order);

      // Có thể bulk insert thay vì từng cái để tối ưu
      const savedOrders = await orderRepository.save(ordersToCreate);

      await queryRunner.commitTransaction();
      return savedOrders;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const dbError = err as { code?: string; message?: string };
      // Bắt lỗi trùng lặp Tracking Number (Unique constraint)
      if (dbError.code === '23505' || dbError.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(
          `Lỗi trùng lặp dữ liệu: Mã vận đơn đã tồn tại trên hệ thống.`,
        );
      }
      throw new BadRequestException(
        `Lỗi database khi import: ${dbError.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Export dữ liệu đơn hàng thành file Excel.
   * Nếu có shipmentId -> Xuất biên bản bàn giao.
   * Nếu có date -> Xuất báo cáo trong ngày.
   */
  async exportOrders(shipmentId?: string, date?: string): Promise<Buffer> {
    const queryBuilder = this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order');

    if (shipmentId) {
      queryBuilder
        .innerJoinAndSelect('order.shipments', 'shipment')
        .where('shipment.id = :shipmentId', { shipmentId });
    } else if (date) {
      // Giả sử lấy báo cáo ngày theo created_at
      queryBuilder.where('DATE(order.created_at) = :date', { date });
    }

    const orders = await queryBuilder.getMany();

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách Đơn hàng');

    // Tạo Header
    worksheet.columns = [
      { header: 'Mã vận đơn', key: 'tracking_number', width: 20 },
      { header: 'Trạng thái', key: 'current_status', width: 15 },
      { header: 'Người gửi', key: 'sender_name', width: 20 },
      { header: 'SĐT Gửi', key: 'sender_phone', width: 15 },
      { header: 'Địa chỉ Gửi', key: 'sender_address', width: 30 },
      { header: 'Người nhận', key: 'receiver_name', width: 20 },
      { header: 'SĐT Nhận', key: 'receiver_phone', width: 15 },
      { header: 'Địa chỉ Nhận', key: 'receiver_address', width: 30 },
      { header: 'Khối lượng (kg)', key: 'weight', width: 15 },
      { header: 'Thu hộ COD (VNĐ)', key: 'cod_amount', width: 20 },
    ];

    // Tạo style cho header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Đổ dữ liệu
    orders.forEach((order) => {
      worksheet.addRow({
        tracking_number: order.tracking_number,
        current_status: order.current_status,
        sender_name: order.sender_name,
        sender_phone: order.sender_phone,
        sender_address: order.sender_address,
        receiver_name: order.receiver_name,
        receiver_phone: order.receiver_phone,
        receiver_address: order.receiver_address,
        weight: order.weight,
        cod_amount: order.cod_amount,
      });
    });

    // Xuất ra buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
