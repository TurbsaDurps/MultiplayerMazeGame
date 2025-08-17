export interface User {
  id: string;
  username: string;
  email: string;
  coins: number;
  createdAt: Date;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
}