import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Transaction } from './transaction.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return this.walletsRepository.find({
      relations: { user: true },
    });
  }

  async remitCod(shipperId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Số tiền nộp phải lớn hơn 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: shipperId } },
        lock: { mode: 'pessimistic_write' },
        relations: { user: true },
      });

      if (!wallet) {
        throw new NotFoundException('Không tìm thấy ví cho tài xế này');
      }

      if (wallet.cod_debt < amount) {
        throw new BadRequestException('Số tiền nộp lớn hơn dư nợ COD hiện tại');
      }

      wallet.cod_debt = Number(wallet.cod_debt) - amount;

      await queryRunner.manager.save(Wallet, wallet);

      const transaction = queryRunner.manager.create(Transaction, {
        wallet,
        amount: -amount,
        type: 'COD_REMITTED',
        description: `Nộp quỹ COD số tiền ${amount}`,
      });

      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Nộp quỹ COD thành công',
        wallet,
        transaction,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
