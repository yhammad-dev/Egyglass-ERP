import { Role, Department } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    department: Department;
  }
  interface Session {
    user: User & {
      id: string;
      role: Role;
      department: Department;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    department: Department;
  }
}
