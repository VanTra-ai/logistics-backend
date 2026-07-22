import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as exceljs from 'exceljs';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class OrdersExcelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly financeService: FinanceService,
  ) {}

  /**
   * Import đơn hàng từ file Excel/CSV.
   * Yêu cầu: Sử dụng Database Transaction để rollback nếu có lỗi ở bất kỳ dòng nào.
   */
  async importOrders(
    fileBuffer: Buffer,
    user?: { role: string; hubId?: string },
  ): Promise<Order[]> {
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

    const tariff = await this.financeService.getTariff();
    const rowErrors: { row: number; errors: string[] }[] = [];
    const ordersToCreate: Partial<Order>[] = [];

    let pickup_hub: any = null;
    if (user?.role === 'HUB_COORDINATOR' && user.hubId) {
      pickup_hub = { id: user.hubId };
    }

    // Header được giả định nằm ở dòng 1.
    const colMap = {
      tracking: -1,
      sender_name: -1,
      sender_phone: -1,
      sender_address: -1,
      receiver_name: -1,
      receiver_phone: -1,
      receiver_address: -1,
      weight: -1,
      cod: -1,
      length: -1,
      width: -1,
      height: -1,
    };
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const header = cell.text?.toLowerCase().trim() || '';
      if (header.includes('mã')) colMap.tracking = colNumber;
      else if (
        header.includes('người gửi') ||
        header.includes('tên gửi') ||
        header.includes('họ tên gửi')
      )
        colMap.sender_name = colNumber;
      else if (
        header.includes('sđt gửi') ||
        header.includes('sdt gửi') ||
        header.includes('điện thoại gửi')
      )
        colMap.sender_phone = colNumber;
      else if (header.includes('địa chỉ gửi'))
        colMap.sender_address = colNumber;
      else if (
        header.includes('người nhận') ||
        header.includes('tên nhận') ||
        header.includes('họ tên nhận')
      )
        colMap.receiver_name = colNumber;
      else if (
        header.includes('sđt nhận') ||
        header.includes('sdt nhận') ||
        header.includes('điện thoại nhận')
      )
        colMap.receiver_phone = colNumber;
      else if (header.includes('địa chỉ nhận'))
        colMap.receiver_address = colNumber;
      else if (header.includes('khối lượng') || header.includes('cân nặng'))
        colMap.weight = colNumber;
      else if (header.includes('cod') || header.includes('thu hộ'))
        colMap.cod = colNumber;
      else if (header.includes('dài') || header.includes('length'))
        colMap.length = colNumber;
      else if (header.includes('rộng') || header.includes('width'))
        colMap.width = colNumber;
      else if (header.includes('cao') || header.includes('height'))
        colMap.height = colNumber;
    });

    // Fallback if no matching headers found, assume standard format (either 9 or 8 columns)
    if (colMap.sender_name === -1) {
      const hasTracking = colMap.tracking !== -1;
      colMap.sender_name = hasTracking ? 2 : 1;
      colMap.sender_phone = hasTracking ? 3 : 2;
      colMap.sender_address = hasTracking ? 4 : 3;
      colMap.receiver_name = hasTracking ? 5 : 4;
      colMap.receiver_phone = hasTracking ? 6 : 5;
      colMap.receiver_address = hasTracking ? 7 : 6;
      colMap.weight = hasTracking ? 8 : 7;
      colMap.cod = hasTracking ? 9 : 8;
    }

    worksheet.eachRow((row, rowNumber) => {
      // Bỏ qua dòng tiêu đề
      if (rowNumber === 1) return;

      let tracking_number =
        colMap.tracking !== -1 ? row.getCell(colMap.tracking).text?.trim() : '';
      if (!tracking_number) {
        const prefix = 'VN';
        const year = new Date().getFullYear().toString();
        const randomChars = Math.random()
          .toString(36)
          .substring(2, 7)
          .toUpperCase();
        tracking_number = `${prefix}${year}${randomChars}`;
      }

      const sender_name =
        colMap.sender_name > 0
          ? row.getCell(colMap.sender_name).text?.trim()
          : '';
      const sender_phone =
        colMap.sender_phone > 0
          ? row.getCell(colMap.sender_phone).text?.trim()
          : '';
      const sender_address =
        colMap.sender_address > 0
          ? row.getCell(colMap.sender_address).text?.trim()
          : '';
      const receiver_name =
        colMap.receiver_name > 0
          ? row.getCell(colMap.receiver_name).text?.trim()
          : '';
      const receiver_phone =
        colMap.receiver_phone > 0
          ? row.getCell(colMap.receiver_phone).text?.trim()
          : '';
      const receiver_address =
        colMap.receiver_address > 0
          ? row.getCell(colMap.receiver_address).text?.trim()
          : '';
      const weightStr =
        colMap.weight > 0 ? row.getCell(colMap.weight).text?.trim() : '';
      const codStr = colMap.cod > 0 ? row.getCell(colMap.cod).text?.trim() : '';
      const lengthStr =
        colMap.length > 0 ? row.getCell(colMap.length).text?.trim() : '';
      const widthStr =
        colMap.width > 0 ? row.getCell(colMap.width).text?.trim() : '';
      const heightStr =
        colMap.height > 0 ? row.getCell(colMap.height).text?.trim() : '';

      const rowErrorDetails: string[] = [];

      if (!sender_name) rowErrorDetails.push('Thiếu Người gửi');
      if (!sender_phone) rowErrorDetails.push('Thiếu SĐT gửi');
      if (!sender_address) rowErrorDetails.push('Thiếu Địa chỉ gửi');
      if (!receiver_name) rowErrorDetails.push('Thiếu Người nhận');
      if (!receiver_phone) rowErrorDetails.push('Thiếu SĐT nhận');
      if (!receiver_address) rowErrorDetails.push('Thiếu Địa chỉ nhận');

      const length = lengthStr ? parseFloat(lengthStr) : 0;
      const width = widthStr ? parseFloat(widthStr) : 0;
      const height = heightStr ? parseFloat(heightStr) : 0;

      const rawWeight = weightStr ? parseFloat(weightStr) : 0;
      const divisor = Number(tariff.volumetric_divisor) || 5000;
      const bulkWeight =
        length > 0 && width > 0 && height > 0 && divisor > 0
          ? (length * width * height) / divisor
          : 0;
      const weight = Math.max(rawWeight, bulkWeight);
      const cod_amount = codStr ? parseFloat(codStr) : 0;
      const distance = 5;

      if (weight <= 0)
        rowErrorDetails.push(
          'Thiếu Khối lượng hoặc Kích thước (Dài x Rộng x Cao)',
        );
      if (isNaN(cod_amount)) rowErrorDetails.push('COD không hợp lệ');

      if (rowErrorDetails.length > 0) {
        rowErrors.push({ row: rowNumber, errors: rowErrorDetails });
      } else {
        const surplusPrice = Number(tariff.surplus_weight_price) || 5000;
        ordersToCreate.push({
          tracking_number,
          sender_name,
          sender_phone,
          sender_address,
          receiver_name,
          receiver_phone,
          receiver_address,
          weight,
          length,
          width,
          height,
          cod_amount,
          shipping_fee:
            Number(tariff.base_price_distance) +
            Math.max(0, distance - Number(tariff.base_distance_limit)) *
              Number(tariff.block_price_distance) +
            Math.max(0, weight - 2) * surplusPrice,
          cod_fee:
            cod_amount > 0
              ? (cod_amount * Number(tariff.cod_fee_percent)) / 100
              : 0,
          current_status: 'PENDING',
          cod_status: 'PENDING',
          pickup_hub,
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

      // Có thể bulk insert thay vì từng cái để tối ưu, chia chunk 500
      const savedOrders = await orderRepository.save(ordersToCreate, {
        chunk: 500,
      });

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
   * Import đơn hàng từ file Excel/CSV do Customer upload.
   */
  async importCustomerOrders(
    fileBuffer: Buffer,
    customer: User,
  ): Promise<Order[]> {
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

    const tariff = await this.financeService.getTariff();
    const rowErrors: { row: number; errors: string[] }[] = [];
    const ordersToCreate: Partial<Order>[] = [];

    const colMap = {
      tracking: -1,
      sender_name: -1,
      sender_phone: -1,
      sender_address: -1,
      receiver_name: -1,
      receiver_phone: -1,
      receiver_address: -1,
      weight: -1,
      cod: -1,
      length: -1,
      width: -1,
      height: -1,
    };
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const header = cell.text?.toLowerCase().trim() || '';
      if (header.includes('mã')) colMap.tracking = colNumber;
      else if (
        header.includes('người gửi') ||
        header.includes('tên gửi') ||
        header.includes('họ tên gửi')
      )
        colMap.sender_name = colNumber;
      else if (
        header.includes('sđt gửi') ||
        header.includes('sdt gửi') ||
        header.includes('điện thoại gửi')
      )
        colMap.sender_phone = colNumber;
      else if (header.includes('địa chỉ gửi'))
        colMap.sender_address = colNumber;
      else if (
        header.includes('người nhận') ||
        header.includes('tên nhận') ||
        header.includes('họ tên nhận')
      )
        colMap.receiver_name = colNumber;
      else if (
        header.includes('sđt nhận') ||
        header.includes('sdt nhận') ||
        header.includes('điện thoại nhận')
      )
        colMap.receiver_phone = colNumber;
      else if (header.includes('địa chỉ nhận'))
        colMap.receiver_address = colNumber;
      else if (header.includes('khối lượng') || header.includes('cân nặng'))
        colMap.weight = colNumber;
      else if (header.includes('cod') || header.includes('thu hộ'))
        colMap.cod = colNumber;
      else if (header.includes('dài') || header.includes('length'))
        colMap.length = colNumber;
      else if (header.includes('rộng') || header.includes('width'))
        colMap.width = colNumber;
      else if (header.includes('cao') || header.includes('height'))
        colMap.height = colNumber;
    });

    if (colMap.sender_name === -1) {
      const hasTracking = colMap.tracking !== -1;
      colMap.sender_name = hasTracking ? 2 : 1;
      colMap.sender_phone = hasTracking ? 3 : 2;
      colMap.sender_address = hasTracking ? 4 : 3;
      colMap.receiver_name = hasTracking ? 5 : 4;
      colMap.receiver_phone = hasTracking ? 6 : 5;
      colMap.receiver_address = hasTracking ? 7 : 6;
      colMap.weight = hasTracking ? 8 : 7;
      colMap.cod = hasTracking ? 9 : 8;
    }

    worksheet.eachRow((row, rowNumber) => {
      // Bỏ qua dòng tiêu đề
      if (rowNumber === 1) return;

      let tracking_number =
        colMap.tracking !== -1 ? row.getCell(colMap.tracking).text?.trim() : '';
      if (!tracking_number) {
        const prefix = 'VN';
        const year = new Date().getFullYear().toString();
        const randomChars = Math.random()
          .toString(36)
          .substring(2, 7)
          .toUpperCase();
        tracking_number = `${prefix}${year}${randomChars}`;
      }

      const sender_name =
        colMap.sender_name > 0
          ? row.getCell(colMap.sender_name).text?.trim()
          : '';
      const sender_phone =
        colMap.sender_phone > 0
          ? row.getCell(colMap.sender_phone).text?.trim()
          : '';
      const sender_address =
        colMap.sender_address > 0
          ? row.getCell(colMap.sender_address).text?.trim()
          : '';
      const receiver_name =
        colMap.receiver_name > 0
          ? row.getCell(colMap.receiver_name).text?.trim()
          : '';
      const receiver_phone =
        colMap.receiver_phone > 0
          ? row.getCell(colMap.receiver_phone).text?.trim()
          : '';
      const receiver_address =
        colMap.receiver_address > 0
          ? row.getCell(colMap.receiver_address).text?.trim()
          : '';
      const weightStr =
        colMap.weight > 0 ? row.getCell(colMap.weight).text?.trim() : '';
      const codStr = colMap.cod > 0 ? row.getCell(colMap.cod).text?.trim() : '';
      const lengthStr =
        colMap.length > 0 ? row.getCell(colMap.length).text?.trim() : '';
      const widthStr =
        colMap.width > 0 ? row.getCell(colMap.width).text?.trim() : '';
      const heightStr =
        colMap.height > 0 ? row.getCell(colMap.height).text?.trim() : '';

      const rowErrorDetails: string[] = [];

      if (!sender_name) rowErrorDetails.push('Thiếu Người gửi');
      if (!sender_phone) rowErrorDetails.push('Thiếu SĐT gửi');
      if (!sender_address) rowErrorDetails.push('Thiếu Địa chỉ gửi');
      if (!receiver_name) rowErrorDetails.push('Thiếu Người nhận');
      if (!receiver_phone) rowErrorDetails.push('Thiếu SĐT nhận');
      if (!receiver_address) rowErrorDetails.push('Thiếu Địa chỉ nhận');

      const length = lengthStr ? parseFloat(lengthStr) : 0;
      const width = widthStr ? parseFloat(widthStr) : 0;
      const height = heightStr ? parseFloat(heightStr) : 0;

      const rawWeight = weightStr ? parseFloat(weightStr) : 0;
      const divisor = Number(tariff.volumetric_divisor) || 5000;
      const bulkWeight =
        length > 0 && width > 0 && height > 0 && divisor > 0
          ? (length * width * height) / divisor
          : 0;
      const weight = Math.max(rawWeight, bulkWeight);
      const cod_amount = codStr ? parseFloat(codStr) : 0;
      const distance = 5;

      if (weight <= 0)
        rowErrorDetails.push(
          'Thiếu Khối lượng hoặc Kích thước (Dài x Rộng x Cao)',
        );
      if (isNaN(cod_amount)) rowErrorDetails.push('COD không hợp lệ');

      if (rowErrorDetails.length > 0) {
        rowErrors.push({ row: rowNumber, errors: rowErrorDetails });
      } else {
        const surplusPrice = Number(tariff.surplus_weight_price) || 5000;
        ordersToCreate.push({
          tracking_number,
          sender_name,
          sender_phone,
          sender_address,
          receiver_name,
          receiver_phone,
          receiver_address,
          weight,
          length,
          width,
          height,
          cod_amount,
          shipping_fee:
            Number(tariff.base_price_distance) +
            Math.max(0, distance - Number(tariff.base_distance_limit)) *
              Number(tariff.block_price_distance) +
            Math.max(0, weight - 2) * surplusPrice,
          cod_fee:
            cod_amount > 0
              ? (cod_amount * Number(tariff.cod_fee_percent)) / 100
              : 0,
          current_status: 'PENDING',
          cod_status: 'PENDING',
          customer,
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderRepository = queryRunner.manager.getRepository(Order);
      // Dùng chunk để tối ưu lưu lượng bộ nhớ
      const savedOrders = await orderRepository.save(ordersToCreate, {
        chunk: 500,
      });
      await queryRunner.commitTransaction();
      return savedOrders;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const dbError = err as { code?: string; message?: string };
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
      { header: 'Ngày tạo', key: 'created_at', width: 20 },
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
        created_at: new Date(order.created_at).toLocaleString('vi-VN'),
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
