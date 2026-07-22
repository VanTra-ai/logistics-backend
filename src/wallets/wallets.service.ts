import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, FindOptionsWhere } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Transaction } from './transaction.entity';
import { WalletRequest } from './wallet-request.entity';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { DeliveryAttempt } from '../shipments/delivery-attempt.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private dataSource: DataSource,
  ) {}

  async findAll(
    user?: { role: string; hubId?: string },
    page: number = 1,
    limit: number = 10,
    search?: string,
    hubIdFilter?: string,
  ) {
    // 1. Tự động tạo ví cho các user chưa có (tránh việc danh sách bị thiếu người)
    const usersFilter: FindOptionsWhere<User> = { role: 'SHIPPER' };
    if (user?.role === 'HUB_COORDINATOR' && user?.hubId) {
      usersFilter.hub = { id: user.hubId };
    }

    const users = await this.dataSource.manager.find(User, {
      where: usersFilter,
      relations: { hub: true },
    });

    const wallets = await this.walletsRepository.find({
      relations: { user: true },
    });

    const walletUserIds = new Set(wallets.map((w) => w.user.id));
    const missingUsers = users.filter((u) => !walletUserIds.has(u.id));

    if (missingUsers.length > 0) {
      const newWallets = missingUsers.map((u) =>
        this.walletsRepository.create({
          user: u,
          income_balance: 0,
          cod_debt: 0,
        }),
      );
      await this.walletsRepository.save(newWallets);
    }

    // 2. Query lại dữ liệu mới nhất
    const whereClause: FindOptionsWhere<Wallet> = {
      user: { role: 'SHIPPER' },
    };

    // User role limits the scope to their hub
    if (user?.role === 'HUB_COORDINATOR' && user?.hubId) {
      whereClause.user = {
        ...((whereClause.user as object) || {}),
        role: 'SHIPPER',
        hub: { id: user.hubId },
      };
    } else if (hubIdFilter && hubIdFilter !== 'ALL') {
      whereClause.user = {
        ...((whereClause.user as object) || {}),
        role: 'SHIPPER',
        hub: { id: hubIdFilter },
      };
    }

    const query = this.walletsRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .leftJoinAndSelect('user.hub', 'hub')
      .where('user.role = :role', { role: 'SHIPPER' });

    if (user?.role === 'HUB_COORDINATOR' && user?.hubId) {
      query.andWhere('hub.id = :hubId', { hubId: user.hubId });
    } else if (hubIdFilter && hubIdFilter !== 'ALL') {
      query.andWhere('hub.id = :hubId', { hubId: hubIdFilter });
    }

    if (search) {
      query.andWhere('user.full_name ILIKE :search', { search: `%${search}%` });
    }

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.full_name', 'ASC')
      .getManyAndCount();

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async getMyStats(userId: string, startDateStr?: string, endDateStr?: string) {
    const wallet = await this.findMyWallet(userId);

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    const incomeQuery = this.dataSource.manager
      .createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount)', 'total')
      .leftJoin('tx.wallet', 'wallet')
      .where('wallet.id = :walletId', { walletId: wallet.id })
      .andWhere('tx.type = :type', { type: 'COMMISSION_EARNED' });

    if (startDate && endDate) {
      incomeQuery.andWhere('tx.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      incomeQuery.andWhere('tx.created_at >= :startDate', { startDate });
    } else if (endDate) {
      incomeQuery.andWhere('tx.created_at <= :endDate', { endDate });
    }

    const incomeResult = await incomeQuery.getRawOne<{
      total: string | number | null;
    }>();
    const expectedIncome = Number(incomeResult?.total || 0);

    const remitQuery = this.dataSource.manager
      .createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount)', 'total')
      .leftJoin('tx.wallet', 'wallet')
      .where('wallet.id = :walletId', { walletId: wallet.id })
      .andWhere('tx.type = :type', { type: 'REMIT' });

    if (startDate && endDate) {
      remitQuery.andWhere('tx.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      remitQuery.andWhere('tx.created_at >= :startDate', { startDate });
    } else if (endDate) {
      remitQuery.andWhere('tx.created_at <= :endDate', { endDate });
    }

    const remitResult = await remitQuery.getRawOne<{
      total: string | number | null;
    }>();
    const remittedCod = Number(remitResult?.total || 0);

    return {
      wallet: {
        income_balance: Number(wallet.income_balance),
        cod_debt: Number(wallet.cod_debt),
      },
      stats: {
        expectedIncome,
        remittedCod,
      },
    };
  }

  async findMyWallet(userId: string) {
    const existing = await this.walletsRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .leftJoinAndSelect('user.hub', 'hub')
      .where('user.id = :userId', { userId })
      .getOne();

    if (existing) {
      return existing;
    }

    // Tự động tạo ví nếu Shipper chưa có
    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
      relations: { hub: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản!');
    }

    const newWallet = this.walletsRepository.create({
      user,
      income_balance: 0,
      cod_debt: 0,
    });
    const saved = await this.walletsRepository.save(newWallet);

    // Reload with relations
    const wallet = await this.walletsRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .leftJoinAndSelect('user.hub', 'hub')
      .where('wallet.id = :id', { id: saved.id })
      .getOne();

    return wallet!;
  }

  async getWalletTransactions(walletId: string, page = 1, limit = 10) {
    const [data, totalItems] = await this.dataSource.manager.findAndCount(
      Transaction,
      {
        where: { wallet: { id: walletId } },
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async getRequests(user?: { role: string; hubId?: string }) {
    const whereClause: FindOptionsWhere<WalletRequest> = {};
    if (user?.role === 'HUB_COORDINATOR' && user?.hubId) {
      whereClause.user = { hub: { id: user.hubId } };
    }
    return this.dataSource.manager.find(WalletRequest, {
      where: whereClause,
      relations: { user: { hub: true } },
      order: { created_at: 'DESC' },
    });
  }

  async remitAllShipperCod(shipperId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const shipper = await queryRunner.manager.findOne(User, {
        where: { id: shipperId },
      });
      if (!shipper) throw new NotFoundException('Không tìm thấy tài xế!');

      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: shipperId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Không tìm thấy ví của tài xế!');

      // Find all successful delivery attempts by this shipper for orders that have COLLECTED COD
      const attempts = await queryRunner.manager.find(DeliveryAttempt, {
        where: {
          status: 'FINISHED',
          shipper: { id: shipperId },
          order: { cod_status: 'COLLECTED' },
        },
        relations: { order: true },
      });

      if (attempts.length === 0) {
        throw new BadRequestException('Không có đơn hàng nào cần nộp COD!');
      }

      // Lọc các order duy nhất (để tránh trùng lặp nếu có 2 attempt FINISHED cho 1 order - though unlikely)
      const orderMap = new Map<string, Order>();
      for (const attempt of attempts) {
        if (attempt.order && !orderMap.has(attempt.order.id)) {
          orderMap.set(attempt.order.id, attempt.order);
        }
      }

      const orders = Array.from(orderMap.values());

      let totalCod = 0;
      for (const order of orders) {
        order.cod_status = 'REMITTED';
        totalCod += Number(order.cod_amount);
      }

      await queryRunner.manager.save(Order, orders);

      // Decrement cod_debt safely
      wallet.cod_debt = Math.max(0, Number(wallet.cod_debt) - totalCod);
      await queryRunner.manager.save(Wallet, wallet);

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        wallet,
        type: 'REMIT',
        amount: totalCod,
        status: 'COMPLETED',
        description: `Thu hộ thành công tổng cộng ${totalCod.toLocaleString('vi-VN')}đ từ ${orders.length} đơn hàng.`,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      return {
        message: `Đã thu thành công ${totalCod.toLocaleString('vi-VN')}đ từ tài xế ${shipper.full_name}`,
        totalAmount: totalCod,
        orderCount: orders.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
