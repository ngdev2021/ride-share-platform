const fs = require('fs');
const { exec } = require('child_process');

const prismaSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id       String   @id @default(auto()) @map("_id") @db.ObjectId
  email    String   @unique
  password String
  rides    Ride[]
}

model Ride {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  origin      String
  destination String
  scheduledAt DateTime
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
}
`;

const prismaDirectory = 'prisma';

// Create Prisma directory
if (!fs.existsSync(prismaDirectory)) {
  fs.mkdirSync(prismaDirectory, { recursive: true });
}

// Create schema.prisma file
fs.writeFileSync(`${prismaDirectory}/schema.prisma`, prismaSchema);

// Run Prisma commands
exec('npx prisma generate', (err, stdout, stderr) => {
  if (err) {
    console.error(`exec error: ${err}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);

  console.log(
    'Prisma setup complete. You can now start your application with "npm run start:dev".'
  );
});
