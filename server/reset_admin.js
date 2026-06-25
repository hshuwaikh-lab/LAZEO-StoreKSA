const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@lazeo.com';
  const newPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const updatedUser = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  });
  console.log(`Successfully reset password for ${email} to: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
