const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.shippingMethod.count();
  if (count === 0) {
    await prisma.shippingMethod.create({
      data: {
        name: 'استلام من المتجر',
        price: 0,
        estimatedDays: '1-2 أيام'
      }
    });
    await prisma.shippingMethod.create({
      data: {
        name: 'شحن وتوصيل للمنزل',
        price: 30,
        estimatedDays: '3-5 أيام'
      }
    });
    console.log('تم إضافة طرق الشحن الافتراضية بنجاح!');
  } else {
    console.log('طرق الشحن موجودة مسبقاً.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
