const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('\n=== SEEDING DATABASE ===\n');

  try {
    // 1. Auto-create missing notification settings for all users
    console.log('1. Creating missing notification settings...');
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      const existingSettings = await prisma.notificationSetting.findUnique({
        where: { userId: user.id }
      });
      
      if (!existingSettings) {
        await prisma.notificationSetting.create({
          data: {
            userId: user.id,
            emailNotifications: true,
            pushNotifications: true,
            orderFilled: true,
            priceAlert: true,
            deposit: true,
            withdrawal: true,
            security: true,
            marketing: false
          }
        });
        console.log(`   ✓ Created notification settings for ${user.email}`);
      }
    }

    // 2. Create initial wallet balances (USDT) for testing
    console.log('\n2. Creating initial wallet balances...');
    for (const user of users) {
      const existingWallet = await prisma.walletBalance.findFirst({
        where: { userId: user.id, symbol: 'USDT' }
      });
      
      if (!existingWallet) {
        await prisma.walletBalance.create({
          data: {
            userId: user.id,
            symbol: 'USDT',
            available: 10000, // $10,000 USDT for testing
            locked: 0
          }
        });
        console.log(`   ✓ Created USDT wallet for ${user.email} (10,000 USDT)`);
      }
    }

    // 3. Create some Earn products
    console.log('\n3. Creating Earn products...');
    const earnProducts = [
      {
        symbol: 'USDT',
        name: 'USDT Flexible Savings',
        type: 'FLEXIBLE',
        apy: 5.0,
        minAmount: 100,
        maxAmount: 1000000,
        totalCapacity: 10000000,
        isActive: true,
        riskLevel: 'LOW',
        description: 'Flexible savings with daily interest',
        terms: 'Withdraw anytime without penalty'
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin Locked Staking',
        type: 'LOCKED',
        apy: 8.0,
        durationDays: 30,
        minAmount: 0.001,
        maxAmount: 10,
        totalCapacity: 100,
        isActive: true,
        riskLevel: 'LOW',
        description: '30-day locked staking with 8% APY',
        terms: 'Lock period: 30 days, auto-compound interest'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum Flexible Earn',
        type: 'FLEXIBLE',
        apy: 6.5,
        minAmount: 0.01,
        maxAmount: 100,
        totalCapacity: 1000,
        isActive: true,
        riskLevel: 'LOW',
        description: 'Flexible ETH savings with competitive APY',
        terms: 'Redeem anytime, interest calculated daily'
      }
    ];

    const existingProducts = await prisma.earnProduct.count();
    if (existingProducts === 0) {
      for (const product of earnProducts) {
        await prisma.earnProduct.create({ data: product });
        console.log(`   ✓ Created ${product.name}`);
      }
    } else {
      console.log(`   ℹ Already have ${existingProducts} earn products`);
    }

    // 4. Summary
    console.log('\n=== SEED SUMMARY ===');
    const stats = {
      users: await prisma.user.count(),
      wallets: await prisma.walletBalance.count(),
      notifSettings: await prisma.notificationSetting.count(),
      earnProducts: await prisma.earnProduct.count()
    };
    
    console.log(`✅ Users: ${stats.users}`);
    console.log(`✅ Wallet Balances: ${stats.wallets}`);
    console.log(`✅ Notification Settings: ${stats.notifSettings}`);
    console.log(`✅ Earn Products: ${stats.earnProducts}`);
    
    console.log('\n✨ Database seeded successfully!\n');

  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();
