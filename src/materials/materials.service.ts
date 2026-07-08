import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Material } from './material.entity';
import { OrderMaterial } from './order-material.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(OrderMaterial)
    private readonly orderMaterialsRepository: Repository<OrderMaterial>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    return await this.materialsRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async create(data: { name: string; price: number; stock: number }) {
    const material = this.materialsRepository.create(data);
    return await this.materialsRepository.save(material);
  }

  async update(id: string, data: Partial<Material>) {
    const material = await this.materialsRepository.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Không tìm thấy vật tư');
    }
    Object.assign(material, data);
    return await this.materialsRepository.save(material);
  }

  async delete(id: string) {
    const material = await this.materialsRepository.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Không tìm thấy vật tư');
    }
    material.status = 'INACTIVE';
    await this.materialsRepository.save(material);
    return { message: 'Đã vô hiệu hoá vật tư' };
  }

  async packageOrder(
    orderId: string,
    items: { materialId: string; quantity: number }[],
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      let totalFee = 0;
      const orderMaterialsToSave: OrderMaterial[] = [];

      for (const item of items) {
        const material = await manager.findOne(Material, {
          where: { id: item.materialId, status: 'ACTIVE' },
          lock: { mode: 'pessimistic_write' },
        });

        if (!material) {
          throw new BadRequestException(
            `Vật tư không tồn tại hoặc đã bị vô hiệu hoá`,
          );
        }

        if (material.stock < item.quantity) {
          throw new BadRequestException(
            `Vật tư ${material.name} không đủ số lượng tồn kho (còn ${material.stock})`,
          );
        }

        // Trừ tồn kho
        material.stock -= item.quantity;
        await manager.save(material);

        // Tạo order material
        const orderMaterial = manager.create(OrderMaterial, {
          order,
          material,
          quantity: item.quantity,
          unit_price: material.price,
        });
        orderMaterialsToSave.push(orderMaterial);

        // Tính phí
        totalFee += Number(material.price) * item.quantity;
      }

      await manager.save(OrderMaterial, orderMaterialsToSave);

      // Cập nhật phí vào đơn hàng
      order.material_fee = Number(order.material_fee || 0) + totalFee;
      await manager.save(order);

      return {
        message: 'Đã ghi nhận đóng gói thành công',
        order_id: order.id,
        added_material_fee: totalFee,
        total_material_fee: order.material_fee,
      };
    });
  }

  async rollbackMaterials(orderId: string, manager: EntityManager) {
    // Tìm các bản ghi OrderMaterial của đơn hàng này
    const orderMaterials = await manager.find(OrderMaterial, {
      where: { order: { id: orderId } },
      relations: { material: true },
    });

    if (orderMaterials.length === 0) return;

    for (const om of orderMaterials) {
      if (om.quantity > 0) {
        // Hoàn lại kho
        const material = await manager.findOne(Material, {
          where: { id: om.material.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (material) {
          material.stock += om.quantity;
          await manager.save(Material, material);
        }

        // Đánh dấu là đã hoàn
        om.quantity = 0;
        await manager.save(OrderMaterial, om);
      }
    }

    // Reset material_fee của đơn hàng
    const order = await manager.findOne(Order, {
      where: { id: orderId },
    });
    if (order) {
      order.material_fee = 0;
      await manager.save(Order, order);
    }
  }
}
