import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/utils/auth.utils';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await hashPassword('Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cryptoexchange.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@cryptoexchange.com',
      passwordHash: adminPassword,
      isVerified: true,
      isActive: true,
      kycStatus: 'APPROVED',
    },
  });

  // Create admin preferences
  await prisma.userPreference.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      language: 'en',
      currency: 'USD',
      theme: 'dark',
    },
  });

  // Create demo user
  const demoPassword = await hashPassword('Demo123!');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@cryptoexchange.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@cryptoexchange.com',
      passwordHash: demoPassword,
      isVerified: true,
      isActive: true,
      kycStatus: 'APPROVED',
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
    },
  });

  // Add initial balance to demo user
  await prisma.walletBalance.upsert({
    where: {
      userId_symbol: {
        userId: demoUser.id,
        symbol: 'USDT',
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      symbol: 'USDT',
      available: new Decimal(10000),
      locked: new Decimal(0),
    },
  });

  await prisma.walletBalance.upsert({
    where: {
      userId_symbol: {
        userId: demoUser.id,
        symbol: 'BTC',
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      symbol: 'BTC',
      available: new Decimal(0.5),
      locked: new Decimal(0),
    },
  });

  await prisma.walletBalance.upsert({
    where: {
      userId_symbol: {
        userId: demoUser.id,
        symbol: 'ETH',
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      symbol: 'ETH',
      available: new Decimal(5),
      locked: new Decimal(0),
    },
  });

  // Create sample earn products
  await prisma.earnProduct.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'FLEXIBLE',
      apy: new Decimal(3.5),
      durationDays: null,
      minAmount: new Decimal(0.001),
      maxAmount: new Decimal(100),
      totalCapacity: new Decimal(1000),
      totalStaked: new Decimal(0),
      isActive: true,
      riskLevel: 'LOW',
      description: 'Flexible Bitcoin staking with daily rewards',
      terms: 'Stake and unstake anytime without penalties',
    },
  });

  await prisma.earnProduct.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'FLEXIBLE',
      apy: new Decimal(4.2),
      durationDays: null,
      minAmount: new Decimal(0.01),
      maxAmount: new Decimal(1000),
      totalCapacity: new Decimal(5000),
      totalStaked: new Decimal(0),
      isActive: true,
      riskLevel: 'LOW',
      description: 'Flexible Ethereum staking with competitive APY',
      terms: 'Stake and unstake anytime without penalties',
    },
  });

  await prisma.earnProduct.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'LOCKED',
      apy: new Decimal(8.5),
      durationDays: 30,
      minAmount: new Decimal(0.01),
      maxAmount: new Decimal(50),
      totalCapacity: new Decimal(500),
      totalStaked: new Decimal(0),
      isActive: true,
      riskLevel: 'MEDIUM',
      description: '30-day locked Bitcoin staking with high APY',
      terms: 'Locked for 30 days, early unstake forfeits all rewards',
    },
  });

  await prisma.earnProduct.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'LOCKED',
      apy: new Decimal(10.0),
      durationDays: 90,
      minAmount: new Decimal(0.1),
      maxAmount: new Decimal(500),
      totalCapacity: new Decimal(2000),
      totalStaked: new Decimal(0),
      isActive: true,
      riskLevel: 'MEDIUM',
      description: '90-day locked Ethereum staking with premium APY',
      terms: 'Locked for 90 days, early unstake forfeits all rewards',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('\n📝 Demo Accounts:');
  console.log('Admin: admin@cryptoexchange.com / Admin123!');
  console.log('Demo User: demo@cryptoexchange.com / Demo123!');
  console.log('\n💰 Demo User Balances:');
  console.log('- 10,000 USDT');
  console.log('- 0.5 BTC');
  console.log('- 5 ETH');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
