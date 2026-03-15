import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding Phoenix Business Suite v1.4.0...\n');

  // ── Admin User ──────────────────────────────────────────────────────
  const adminEmail = 'admin@phoenix.com';
  const adminPassword = await bcrypt.hash('Admin@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // Don't overwrite existing admin data
    create: {
      email: adminEmail,
      password: adminPassword,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user:', admin.email);

  // ── Default Settings ────────────────────────────────────────────────
  const settings: Array<{ key: string; value: string }> = [
    { key: 'business_name',     value: 'Phoenix Business Suite' },
    { key: 'business_address',  value: '123 Main Street, City, State 000000' },
    { key: 'business_phone',    value: '+91 9999999999' },
    { key: 'business_email',    value: 'info@phoenix.com' },
    { key: 'gst_number',        value: 'GSTIN0000000000' },
    { key: 'invoice_prefix',    value: 'INV' },
    { key: 'default_tax',       value: '18' },
    { key: 'currency',          value: 'INR' },
    { key: 'currency_symbol',   value: '₹' },
    { key: 'timezone',          value: 'Asia/Kolkata' },
    { key: 'receipt_footer',    value: 'Thank you for your business! For queries, please contact us.' },
    { key: 'meta_api_enabled',  value: '0' },
    { key: 'whatsapp_phone',    value: '' },
    { key: 'whatsapp_message_template_invoice', value: '' },
    { key: 'whatsapp_message_template_repair',  value: '' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {}, // Never overwrite settings the user has already customised
      create: s,
    });
  }
  console.log('✅ Default settings seeded');

  console.log('\n🎉 Seeding complete!\n');
  console.log('═══════════════════════════════════════');
  console.log(' Default Login Credentials             ');
  console.log('═══════════════════════════════════════');
  console.log(' Email:    admin@phoenix.com           ');
  console.log(' Password: Admin@1234                  ');
  console.log('═══════════════════════════════════════');
  console.log('\n⚠️  IMPORTANT: Change the default password');
  console.log('   immediately after your first login!\n');
}

seed()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
