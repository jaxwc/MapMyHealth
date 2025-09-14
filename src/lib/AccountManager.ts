// AccountManager.ts
import * as z from "zod";

// -----------------
// Zod schema for validation
// -----------------
export const accountSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  dob: z.string().nonempty("Date of birth is required"),
  gender: z.enum(["male", "female"]),
  heightFeet: z.string().optional(),
  heightInches: z.string().optional(),
  weight: z.string().optional(),
  conditions: z.string().optional(),
});

// -----------------
// Account interface
// -----------------
export interface Account {
  id: number;
  fullName: string;
  email: string;
  password: string;
  dob: Date;
  gender: "male" | "female";
  heightFeet?: number;
  heightInches?: number;
  weight?: number;
  conditions?: string;
  createdAt: Date;
  updatedAt: Date;
}

// -----------------
// AccountManager class
// -----------------
export class AccountManager {
  private accounts: Map<number, Account> = new Map();
  private nextId: number = 1;

  createAccount(data: Omit<Account, "id" | "createdAt" | "updatedAt">): Account {
    const newAccount: Account = {
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.accounts.set(newAccount.id, newAccount);
    return newAccount;
  }

  updateAccount(
    id: number,
    updates: Partial<Omit<Account, "id" | "createdAt">>
  ): Account | undefined {
    const account = this.accounts.get(id);
    if (!account) return undefined;

    const updatedAccount: Account = {
      ...account,
      ...updates,
      updatedAt: new Date(),
    };
    this.accounts.set(id, updatedAccount);
    return updatedAccount;
  }

  getAccountById(id: number): Account | undefined {
    return this.accounts.get(id);
  }

  deleteAccount(id: number): boolean {
    return this.accounts.delete(id);
  }

  listAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }
}

// Optional: instantiate one manager for use across the app
export const accountManager = new AccountManager();
