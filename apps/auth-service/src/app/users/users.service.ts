import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: normalizeEmail(email) });
  }

  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
  }): Promise<User> {
    return this.users.save(
      this.users.create({
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        fullName: data.fullName.trim(),
      }),
    );
  }
}
