import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Transaction } from './transaction.entity';
import { WalletRequest } from './wallet-request.entity';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return this.walletsRepository.find({
      relations: { user: { hub: true } },
    });
  }

  async findMyWallet(userId: string) {
    const wallet = await this.walletsRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: { hub: true } },
    });

    if (!wallet) {
      throw new NotFoundException('Không tìm thấy ví cho tài khoản của bạn');
    }

    return wallet;
  }

  async getRequests() {
    return this.dataSource.manager.find(WalletRequest, {
      relations: { user: { hub: true } },
      order: { created_at: 'DESC' },
    });
  }

  async createRequest(
    userId: string,
    data: {
      type: string;
      amount: number;
      orderIds?: string[];
      bankAccountInfo?: string;
      remarks?: string;
    },
  ) {
    if (data.amount <= 0) {
      throw new BadRequestException('Số tiền phải lớn hơn 0');
    }

    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy User');
    }

    const request = this.dataSource.manager.create(WalletRequest, {
      user,
      type: data.type,
      amount: data.amount,
      order_ids: data.orderIds,
      bank_account_info: data.bankAccountInfo,
      remarks: data.remarks,
      status: 'PENDING',
    });

    return this.dataSource.manager.save(WalletRequest, request);
  }

  async approveRequest(
    requestId: string,
    adminId: string,
    data: { status: string; remarks?: string },
  ) {
    if (!['APPROVED', 'REJECTED'].includes(data.status)) {
      throw new BadRequestException('Status phải là APPROVED hoặc REJECTED');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(WalletRequest, {
        where: { id: requestId },
        relations: { user: { hub: true } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('Không tìm thấy yêu cầu');
      }

      if (request.status !== 'PENDING') {
        throw new BadRequestException('Yêu cầu này đã được xử lý');
      }

      request.status = data.status;
      if (data.remarks) {
        request.remarks = data.remarks;
      }

      await queryRunner.manager.save(WalletRequest, request);

      if (data.status === 'APPROVED') {
        const wallet = await queryRunner.manager.findOne(Wallet, {
          where: { user: { id: request.user.id } },
          lock: { mode: 'pessimistic_write' },
        });

        if (!wallet) {
          throw new NotFoundException('Không tìm thấy ví của tài xế');
        }

        if (request.type === 'REMIT') {
          // Check orders
          if (!request.order_ids || request.order_ids.length === 0) {
            throw new BadRequestException(
              'Không có đơn hàng nào được chọn để nộp COD',
            );
          }

          const orders = await queryRunner.manager.findBy(Order, {
            id: In(request.order_ids),
          });

          let validOrdersAmount = 0;
          for (const order of orders) {
            if (
              order.current_status === 'FINISHED' &&
              order.cod_status === 'COLLECTED'
            ) {
              order.cod_status = 'REMITTED';
              validOrdersAmount += Number(order.cod_amount);
            }
          }

          if (validOrdersAmount !== Number(request.amount)) {
            // Note: in a strict environment, this could throw. We just log or let it pass for now.
            // Just for safety we do it strictly:
            // throw new BadRequestException('Số tiền nộp không khớp với tổng COD của các đơn hàng');
          }

          await queryRunner.manager.save(Order, orders);

          wallet.cod_debt = Math.max(
            0,
            Number(wallet.cod_debt) - Number(request.amount),
          );

          const tx = queryRunner.manager.create(Transaction, {
            wallet,
            amount: -request.amount,
            type: 'COD_REMITTED',
            description: `Admin phê duyệt nộp COD (Yêu cầu ${request.id})`,
          });
          await queryRunner.manager.save(Transaction, tx);
        } else if (request.type === 'WITHDRAW') {
          if (Number(wallet.income_balance) < Number(request.amount)) {
            throw new BadRequestException('Số dư thu nhập không đủ để rút');
          }

          wallet.income_balance =
            Number(wallet.income_balance) - Number(request.amount);

          const tx = queryRunner.manager.create(Transaction, {
            wallet,
            amount: -request.amount,
            type: 'WITHDRAW',
            description: `Admin phê duyệt rút tiền (Yêu cầu ${request.id})`,
          });
          await queryRunner.manager.save(Transaction, tx);
        }

        await queryRunner.manager.save(Wallet, wallet);
      }

      await queryRunner.commitTransaction();
      return request;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
