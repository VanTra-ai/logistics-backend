import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// 1. Định nghĩa khuôn mẫu cho User được giải mã từ Token
interface RequestUser {
  userId: string;
  email: string;
  role: string;
}

// 2. Định nghĩa khuôn mẫu cho Request chứa User
interface AuthenticatedRequest {
  user?: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    // 3. Ép kiểu an toàn (Type Casting) cho Request để ESLint ngừng báo lỗi
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Bạn không có quyền truy cập. Hệ thống yêu cầu một trong các quyền sau: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
