// lib/db.ts - Neon 数据库连接文件
// 依赖：@neondatabase/serverless（需先安装：pnpm add @neondatabase/serverless）
import { neon, neonConfig } from '@neondatabase/serverless';

// 配置 Neon 连接（可选，优化生产环境性能）
neonConfig.fetchConnectionCache = true;

// 从环境变量读取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL;

// 校验环境变量是否配置
if (!DATABASE_URL) {
  throw new Error(
    '未配置 DATABASE_URL 环境变量！请在 .env.local 文件中添加 DATABASE_URL=你的Neon连接字符串'
  );
}

// 创建数据库连接实例并导出
const sql = neon(DATABASE_URL);

export default sql;