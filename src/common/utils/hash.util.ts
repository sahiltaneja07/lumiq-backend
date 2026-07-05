import * as bcrypt from 'bcrypt';

export class HashUtil {
  static async hash(data: string, saltRounds: number = 10): Promise<string> {
    return bcrypt.hash(data, saltRounds);
  }

  static async compare(data: string, encrypted: string): Promise<boolean> {
    return bcrypt.compare(data, encrypted);
  }
}
