import { SetMetadata } from '@nestjs/common';

// Tạo ra một @Roles() decorator để sử dụng trong Controller
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
